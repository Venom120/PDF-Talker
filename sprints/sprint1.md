# Prerequisites (do this first)

1. Install & configure:

   * AWS CLI v2 (configured with `aws configure` or an AWS_PROFILE).
   * `git` and (optionally) `gh` CLI (GitHub).
   * Python 3.11 (for Lambda dev), `zip`.
   * Node (for frontend later).
2. Pick an AWS region (I recommend `ap-south-1` for Mumbai if you want lower latency in India). Set `AWS_REGION` accordingly.
3. Choose a unique suffix for global names: `SUFFIX=yourhandle123` (lowercase, alphanumeric). Keep it short.

Set these env vars in your shell before running commands:

```bash
export AWS_PROFILE=default            # or your profile name
export AWS_REGION=ap-south-1         # change if you want another region
export SUFFIX=demo123                # replace with your unique suffix
```

Get your AWS account id (you’ll need it for IAM ARNs):

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --profile $AWS_PROFILE)
echo $ACCOUNT_ID
```

---

# Sprint 1 — step-by-step (do this **now**)

## 1) Create Git repo `PDF-Talker` (local + GitHub)

Do this from a terminal in your projects directory.

Local repo + structure:

```bash
mkdir PDF-Talker && cd PDF-Talker
git init
git checkout -b dev

# basic files
cat > README.md <<'EOF'
# PDF-Talker
Voice-based PDF Q&A with a 3D avatar (hackathon repo).
EOF

cat > .gitignore <<'EOF'
node_modules/
venv/
__pycache__/
.env
.DS_Store
*.pyc
dist/
build/
EOF

# skeleton folders
mkdir -p frontend/{public,src} backend/{lambdas,services} infra
git add .
git commit -m "chore: repo skeleton"
```

Push to GitHub (option A: `gh` CLI; option B: manual):
Option A (`gh` installed):

```bash
gh repo create YOUR_GITHUB_USERNAME/PDF-Talker --public --description "PDF-Talker" --source=. --remote=origin --push
```

Option B (manual):

```bash
# create repo on github.com (UI) then:
git remote add origin git@github.com:YOUR_GITHUB_USERNAME/PDF-Talker.git
git push -u origin dev
```

**Acceptance:** repo exists on GitHub as `PDF-Talker`, branch `dev` present.

---

## 2) Create S3 buckets (PDFs + assets)

Naming rule you asked: prefix `PDF-Talker-pds-<your-suffix>` — we'll create two buckets that use that prefix:

```bash
PDF_BUCKET="pdf-talker-pds-${SUFFIX}-pdfs"
ASSETS_BUCKET="pdf-talker-pds-${SUFFIX}-assets"

aws s3 mb s3://$PDF_BUCKET --region $AWS_REGION --profile $AWS_PROFILE
aws s3 mb s3://$ASSETS_BUCKET --region $AWS_REGION --profile $AWS_PROFILE
```

Notes:

* S3 bucket names must be globally unique — if the `mb` fails, append a short random string to `$SUFFIX`.
* For hackathon, you can keep public access blocked; we'll use presigned uploads.

**Acceptance:** both buckets exist and `aws s3 ls` shows them.

Verify:

```bash
aws s3 ls s3://$PDF_BUCKET --profile $AWS_PROFILE
```

---

## 3) Create DynamoDB table `pdf_talker_sessions`

Use on-demand billing (PAY_PER_REQUEST) for convenience.

```bash
aws dynamodb create-table \
  --table-name pdf_talker_sessions \
  --attribute-definitions AttributeName=session_id,AttributeType=S \
  --key-schema AttributeName=session_id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region $AWS_REGION --profile $AWS_PROFILE
```

**Acceptance:** `aws dynamodb describe-table --table-name pdf_talker_sessions` returns `ACTIVE`.

---

## 4) Create IAM role for Lambdas + attach policies

We create a single Lambda execution role `pdf-talker-lambda-exec` and attach AWSLambdaBasicExecutionRole and a small inline policy for S3/DynamoDB/Bedrock/logs.

Create trust policy:

```bash
cat > lambda-trust.json <<'EOF'
{
  "Version":"2012-10-17",
  "Statement":[
    {
      "Effect":"Allow",
      "Principal":{"Service":"lambda.amazonaws.com"},
      "Action":"sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role --role-name pdf-talker-lambda-exec --assume-role-policy-document file://lambda-trust.json --profile $AWS_PROFILE
```

Attach AWS managed basic policy:

```bash
aws iam attach-role-policy --role-name pdf-talker-lambda-exec \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole \
  --profile $AWS_PROFILE
```

Create inline policy (replace `$ACCOUNT_ID` and `$SUFFIX` are filled from your env):

```bash
cat > lambda-inline-policy.json <<EOF
{
  "Version":"2012-10-17",
  "Statement":[
    {
      "Effect":"Allow",
      "Action":[ "s3:GetObject", "s3:PutObject", "s3:ListBucket" ],
      "Resource":[
        "arn:aws:s3:::$PDF_BUCKET",
        "arn:aws:s3:::$PDF_BUCKET/*",
        "arn:aws:s3:::$ASSETS_BUCKET",
        "arn:aws:s3:::$ASSETS_BUCKET/*"
      ]
    },
    {
      "Effect":"Allow",
      "Action":[ "dynamodb:PutItem", "dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:Query" ],
      "Resource":"arn:aws:dynamodb:$AWS_REGION:$ACCOUNT_ID:table/pdf_talker_sessions"
    },
    {
      "Effect":"Allow",
      "Action":[ "logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents" ],
      "Resource":"arn:aws:logs:$AWS_REGION:$ACCOUNT_ID:*"
    },
    {
      "Effect":"Allow",
      "Action":[ "bedrock:InvokeModel" ],
      "Resource":"*"
    }
  ]
}
EOF

aws iam put-role-policy --role-name pdf-talker-lambda-exec --policy-name pdf-talker-inline-policy --policy-document file://lambda-inline-policy.json --profile $AWS_PROFILE
```

Notes:

* `bedrock:InvokeModel` is included because you’ll need it later. If you don’t yet have Bedrock access, that statement harmlessly remains; you can tighten later.
* Replace `bedrock` action if you want stricter scoping later.

**Acceptance:** role created; `aws iam get-role --role-name pdf-talker-lambda-exec` returns role.

---

## 5) Create Lambda skeletons (presign_upload & s3_ingest_trigger)

Create two small Lambda functions locally, zip them, then create them in AWS.

**presign_upload.py** (backend/lambdas/presign_upload.py)

```python
# presign_upload.py
import os, json, boto3

s3 = boto3.client('s3')
PDF_BUCKET = os.environ.get('PDF_BUCKET')

def lambda_handler(event, context):
    # expects JSON body: {"key":"uploads/filename.pdf"} or will generate one
    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except:
            body = {}
    key = body.get('key') or f"uploads/{context.aws_request_id}.pdf"
    url = s3.generate_presigned_url('put_object', Params={'Bucket': PDF_BUCKET, 'Key': key}, ExpiresIn=3600)
    return {
        "statusCode": 200,
        "headers":{"Content-Type":"application/json"},
        "body": json.dumps({"upload_url": url, "s3_key": key})
    }
```

**s3_ingest_trigger.py** (backend/lambdas/s3_ingest_trigger.py)

```python
# s3_ingest_trigger.py
import json, logging, boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)
s3 = boto3.client('s3')

def lambda_handler(event, context):
    logger.info("Received S3 event: %s", json.dumps(event))
    for rec in event.get('Records', []):
        bucket = rec['s3']['bucket']['name']
        key = rec['s3']['object']['key']
        logger.info(f"New object: s3://{bucket}/{key}")
        # TODO: download object, run text extraction (PyMuPDF/pdfminer), chunk, push to Kendra/OpenSearch
    return {"statusCode":200}
```

Zip & create functions (example for presign):

```bash
cd backend/lambdas
zip presign.zip presign_upload.py
aws lambda create-function \
  --function-name pdf-talker-presign-upload \
  --runtime python3.11 \
  --role arn:aws:iam::$ACCOUNT_ID:role/pdf-talker-lambda-exec \
  --handler presign_upload.lambda_handler \
  --zip-file fileb://presign.zip \
  --environment Variables="{PDF_BUCKET=$PDF_BUCKET}" \
  --timeout 30 --memory-size 128 \
  --region $AWS_REGION --profile $AWS_PROFILE
```

Repeat for `s3_ingest_trigger.py`:

```bash
zip ingest.zip s3_ingest_trigger.py
aws lambda create-function \
  --function-name pdf-talker-s3-ingest \
  --runtime python3.11 \
  --role arn:aws:iam::$ACCOUNT_ID:role/pdf-talker-lambda-exec \
  --handler s3_ingest_trigger.lambda_handler \
  --zip-file fileb://ingest.zip \
  --timeout 30 --memory-size 256 \
  --region $AWS_REGION --profile $AWS_PROFILE
```

**Acceptance:** both Lambda functions created. Verify:

```bash
aws lambda list-functions --profile $AWS_PROFILE --region $AWS_REGION | jq '.Functions[] | {FunctionName,Runtime}'
```

---

## 6) Hook S3 uploads → `s3_ingest_trigger` (S3 event notification)

Allow S3 to invoke the Lambda and configure bucket notification.

Give permission:

```bash
aws lambda add-permission \
  --function-name pdf-talker-s3-ingest \
  --statement-id s3invoke \
  --action "lambda:InvokeFunction" \
  --principal s3.amazonaws.com \
  --source-arn arn:aws:s3:::$PDF_BUCKET \
  --profile $AWS_PROFILE --region $AWS_REGION
```

Then set the bucket notification:

```bash
# Build JSON inline (ensure correct Lambda ARN)
LAMBDA_ARN=$(aws lambda get-function --function-name pdf-talker-s3-ingest --query 'Configuration.FunctionArn' --output text --profile $AWS_PROFILE --region $AWS_REGION)

aws s3api put-bucket-notification-configuration \
  --bucket $PDF_BUCKET \
  --notification-configuration "{
    \"LambdaFunctionConfigurations\": [
      {
        \"LambdaFunctionArn\": \"$LAMBDA_ARN\",
        \"Events\": [\"s3:ObjectCreated:*\"]
      }
    ]
  }" --profile $AWS_PROFILE --region $AWS_REGION
```

**Acceptance:** upload a test file and see the ingest lambda logs.

Test:

1. Get presigned URL:

```bash
# call presign via aws lambda invoke (local test)
aws lambda invoke --function-name pdf-talker-presign-upload \
  --payload '{"body":"{\"key\":\"uploads/test.pdf\"}"}' out.json --profile $AWS_PROFILE --region $AWS_REGION
cat out.json
```

From `out.json` extract `upload_url` and then:

```bash
curl --upload-file sample.pdf "<upload_url>"
```

2. Watch logs:

```bash
aws logs tail /aws/lambda/pdf-talker-s3-ingest --since 5m --follow --profile $AWS_PROFILE --region $AWS_REGION
```

You should see a log line for new S3 object.

---

## 7) Create API Gateway (HTTP) for presign endpoint (simple)

For now create an HTTP API that forwards to the `pdf-talker-presign-upload` Lambda.

Console is easiest: **API Gateway → HTTP API → Add integration → Lambda → select `pdf-talker-presign-upload` → create route** (POST `/presign`) → deploy.

If you want CLI (quick):

```bash
API_ID=$(aws apigatewayv2 create-api --name "pdf-talker-api" --protocol-type HTTP --region $AWS_REGION --profile $AWS_PROFILE --query 'ApiId' --output text)
aws apigatewayv2 create-integration --api-id $API_ID --integration-type AWS_PROXY --integration-uri arn:aws:apigateway:$AWS_REGION:lambda:path/2015-03-31/functions/arn:aws:lambda:$AWS_REGION:$ACCOUNT_ID:function:pdf-talker-presign-upload/invocations --integration-method POST --payload-format-version 2.0 --region $AWS_REGION --profile $AWS_PROFILE
# create route, attach, deploy - I recommend using console for simplicity.
```

Also add permission so API Gateway can invoke the Lambda (if using CLI method).

**Acceptance:** you can `POST` to the API URL `/presign` and get a presigned upload URL.

---

## 8) Create Cognito User Pool (minimal)

You just need a simple user pool for auth in Sprint 1.

Quick CLI:

```bash
POOL_ID=$(aws cognito-idp create-user-pool --pool-name pdf-talker-user-pool --query 'UserPool.Id' --output text --profile $AWS_PROFILE --region $AWS_REGION)
aws cognito-idp create-user-pool-client --user-pool-id $POOL_ID --client-name pdf-talker-client --no-generate-secret --query 'UserPoolClient.ClientId' --output text --profile $AWS_PROFILE --region $AWS_REGION
```

Console steps (recommended for UI config):

* Cognito → Manage User Pools → Create new pool → name it `pdf-talker-user-pool` → App clients → add client (no secret) → set callback URL to `http://localhost:3000` while developing.

**Acceptance:** you can create a user in the pool (console) and call `AdminInitiateAuth` / test login later.

---

## 9) Quick checklist & verification (must pass these before Sprint 2)

* [ ] GitHub repo `PDF-Talker` created & `dev` branch pushed.
* [ ] Two S3 buckets exist: `pdf-talker-pds-<SUFFIX>-pdfs` and `pdf-talker-pds-<SUFFIX>-assets`.
* [ ] DynamoDB table `pdf_talker_sessions` is `ACTIVE`.
* [ ] IAM role `pdf-talker-lambda-exec` exists and has inline policy.
* [ ] Lambdas `pdf-talker-presign-upload` and `pdf-talker-s3-ingest` exist and have correct env var `PDF_BUCKET`.
* [ ] S3 event notifications invoke the ingest Lambda (verified by upload & CloudWatch logs).
* [ ] API Gateway route for presign upload works (test via `curl` or `aws lambda invoke`).
* [ ] Cognito user pool `pdf-talker-user-pool` created with an app client.

If any of these fail, stop and fix it — Sprint 2 depends on this.

---

## Useful snippets & commands to copy later

* Get Lambda logs quickly:

```bash
aws logs tail /aws/lambda/pdf-talker-presign-upload --since 1h --follow --profile $AWS_PROFILE --region $AWS_REGION
```

* Delete resources (cleanup after hackathon to avoid charges — **do this**):

```bash
# remove lambda
aws lambda delete-function --function-name pdf-talker-presign-upload --profile $AWS_PROFILE --region $AWS_REGION
# delete s3 buckets (must be empty)
aws s3 rb s3://$PDF_BUCKET --force --profile $AWS_PROFILE
aws s3 rb s3://$ASSETS_BUCKET --force --profile $AWS_PROFILE
# delete dynamodb
aws dynamodb delete-table --table-name pdf_talker_sessions --profile $AWS_PROFILE --region $AWS_REGION
# and remove role/policies
aws iam delete-role-policy --role-name pdf-talker-lambda-exec --policy-name pdf-talker-inline-policy --profile $AWS_PROFILE
aws iam detach-role-policy --role-name pdf-talker-lambda-exec --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole --profile $AWS_PROFILE
aws iam delete-role --role-name pdf-talker-lambda-exec --profile $AWS_PROFILE
```

---

## Sprint 1 deliverables (what you must commit to the repo)

1. README updated with Sprint 1 notes + env var examples.
2. `backend/lambdas/presign_upload.py` and `s3_ingest_trigger.py` with a short `README` describing how to deploy them (commands you used).
3. `infra/` contains a small `instructions.md` listing the resources you created and ARNs (S3 bucket names, Dynamo table name, role ARN, Lambda ARNs, API Gateway URL, Cognito pool ID).

Commit & push:

```bash
git add .
git commit -m "feat: sprint1 infra skeleton and lambda starters"
git push origin dev
```

---

# What I expect you to run next (and what I’ll do if you ask)

* Run the commands above and finish the checklist.
* Once you confirm all checks pass (or paste the output of failures), I’ll produce:

  * a minimal SAM template (CloudFormation) to replace manual CLI steps, **and**
  * a ready-to-drop `README.md` + `issues` for Sprint 2 (frontend: PDF viewer & upload) and the actual `presign` API Gateway route mapping.

If you want that SAM template now I can produce it — but do the manual steps first so you understand the plumbing.

---