# Quick tech summary (single line)

Frontend: React + pdf.js + three.js (or Babylon)
Realtime voice: Amazon Nova Sonic (preferred) **or** Transcribe + Bedrock + Polly fallback.
LLM + agent orchestration: Amazon Bedrock (InvokeModel/Converse).
Document indexing/retrieval: Amazon Kendra (or OpenSearch vector index).
Storage & hosting: S3 + CloudFront; compute: Lambda / ECS-Fargate; auth: Cognito.
(Why Nova Sonic? it unifies speech-in / speech-out in Bedrock — simplifies pipeline.) ([Amazon Web Services, Inc.][1])

---

# The sprints (Agile-style: Sprint backlog items, tasks, acceptance criteria, resources to add in the AWS “Search and select resources (manual)” step)

## Sprint 0 — Repo, project board, skeleton (Epic: initialize)

**Goal:** repo + issue board + minimal README so team has a single source of truth.
**Tasks**

1. Create GitHub repo and basic branches:

```bash
mkdir ai-agent && cd ai-agent
git init
gh repo create your-org/ai-agent --public --description "Voice PDF Q&A with 3D avatar"
git checkout -b dev
```

2. Create Issues/Project board: Epics = infra, frontend, ingestion, voice, avatar, demo.
3. Add skeleton file structure:

```
/frontend    (React app)
 /public
 /src
/backend     (Python Lambda + API code)
 /services
 /infra      (CloudFormation / Terraform / SAM / CDK)
README.md
CONTRIBUTING.md
```

**Deliverable:** repo with `dev` branch, issue board with epics, README with sprint plan.
**AWS resources to *prepare to add later*:** none yet.

---

## Sprint 1 — Core infra & IAM (Epic: plumbing)

**Goal:** Create required AWS primitives so devs can work safely: S3 buckets, Cognito, minimal IAM roles, API Gateway placeholder, Lambda skeleton, DynamoDB sessions table.
**Tasks**

1. Console: create S3 buckets:

   * `ai-agent-pdfs-<your-suffix>`
   * `ai-agent-assets-<your-suffix>`
2. Create Cognito User Pool (or use Amplify Auth later).

   * Use the console wizard — enable app client, set callback URL to your local dev frontend if needed.
3. Create IAM roles:

   * `lambda-basic-exec` (AWSLambdaBasicExecutionRole + S3 read/write)
   * `bedrock-invoke-role` (policy allowing `bedrock:InvokeModel`) *only for dev/hackathon*.
4. Create DynamoDB table `ai_sessions` (PK `session_id`) for session context.
5. Create Lambda function skeletons (Python 3.11):

   * `presign_upload` — generates S3 presigned URL for PDF upload.
   * `s3_ingest_trigger` — triggered by S3 Put (extract text and kick ingestion).
   * `bedrock_proxy` — receives client requests, interacts with Bedrock/Kendra/OpenSearch.
6. Create API Gateway (HTTP) endpoint to front the bedrock_proxy and presign endpoints. If you need real-time, create a WebSocket API later.
   **What to select in “Search and select resources (manual)”**:

* S3 (create buckets)
* AWS::Lambda::Function (create Lambda(s))
* Amazon API Gateway (HTTP; WebSocket planned later)
* AWS::DynamoDB::Table (`ai_sessions`)
* Amazon Cognito (User Pool)
* IAM Role(s) for Lambda + Bedrock access
  **Deliverable (Definition of Done):** frontend can get a presigned URL and upload a PDF to S3; S3 Put generates a CloudWatch log from an ingest Lambda.

---

## Sprint 2 — Frontend: PDF viewer + upload flow + basic UI

**Goal:** Build the UI that uploads a PDF and displays it (no voice yet).
**Tasks**

1. React app scaffold (Vite or CRA).
2. PDF viewer: use `pdf.js` to render and allow page highlighting/search. Add an Upload page calling `presign_upload`.
3. Basic session UI: login (via Cognito), session token stored, tokens attached to API calls.
4. Place-holder avatar area (empty canvas) where the 3D model will later run.
   **Deliverable:** user can login, upload PDF, and view it in the browser. (Add an “Ask” button but it can be disabled for now.)

---

## Sprint 3 — PDF ingestion pipeline (text extraction → semantic store)

**Goal:** Extract text from uploaded PDF, chunk it, and index into a semantic store (Kendra or vector DB).
**Tasks**

1. Lambda `s3_ingest_trigger` gets S3 `Put` event, downloads PDF (use `pdfminer.six` or `PyMuPDF`/`fitz`) and extracts text + metadata, split into 500–1000 token chunks.
2. For semantic storage choose one:

   * **Amazon Kendra** (managed semantic search + Q/A ingestion; easiest to get good, grounded results). Create a Kendra index and import S3 as a data source (or use the BatchPutDocument API). ([AWS Documentation][2])
   * **Or**: compute embeddings (Bedrock or open embedding model) and store them in OpenSearch vector index or OpenSearch serverless. (OpenSearch can do vector search.) ([AWS Documentation][3])
3. Store chunk metadata: S3 URI, page numbers, chunk text, embedding id in DynamoDB or metadata DB.
4. Add a small search endpoint `retrieve_chunks(session_id, query)` that returns top-k chunks for a query.
   **Deliverable:** ingestion Lambda that indexes PDF content and a retrieval endpoint that returns relevant chunks.
   **Acceptance:** give the agent a query and it returns the exact PDF chunks that are relevant (no hallucination allowed in this stage).

---

## Sprint 4 — Basic agent + LLM integration (text-only flow)

**Goal:** Make a text-based QA flow: user types a question, backend retrieves chunks, sends them to Bedrock, and returns the answer. (No voice yet.)
**Tasks**

1. Implement `bedrock_proxy` that:

   * Accepts query + session_id,
   * Calls retrieval to get top-k chunks,
   * Constructs a RAG prompt (system + context + chunks + user query),
   * Invokes Bedrock `InvokeModel` or `Converse` for multi-turn. (Use Bedrock runtime APIs.) ([AWS Documentation][4])
2. Return answer text and the source chunk references (for UI highlighting).
3. Add UI: "Ask (text)" that shows model answer and highlights the chunk(s) in the PDF viewer.
   **Deliverable:** text-based QA working end-to-end.
   **Acceptance:** model answers are grounded to returned chunk references ≥ 90% (manual check).

---

## Sprint 5 — Voice I/O (ASR/TTS) — two options

**Goal:** Add speech input and speech output so the user can *talk* to the agent, and the agent replies with audio.

**Option A — Recommended (unified): Amazon Nova Sonic via Bedrock**

* Nova Sonic is a speech-to-speech model in Bedrock that accepts streaming audio and returns streaming speech (unifies ASR + NLU + TTS). If available in your region, this is the fastest path to low-latency voice. ([Amazon Web Services, Inc.][1])

**Option B — Fallback: Transcribe + Bedrock + Polly**

* Browser → audio stream → Transcribe streaming (WebSocket) → text → Bedrock for LLM → Polly for TTS → play audio in browser. Use Transcribe WebSocket for real-time ASR. ([AWS Documentation][5])
* Use Amazon Polly to synthesize audio if you can’t run Nova Sonic for voice output. ([AWS Documentation][6])

**Tasks (general)**

1. If Nova Sonic is available: implement bidirectional streaming with Bedrock Nova Sonic model (socket or WebRTC wrapper). You’ll need to implement a small relay (Lambda or Fargate) to transform browser audio into the Bedrock streaming API and forward responses.
2. If Fallback route: implement Transcribe streaming from browser (WebSocket) to get transcripts (sample repo available from AWS samples). Then call `bedrock_proxy` with transcript and do RAG as before; use Polly to generate TTS and return audio (base64 or presigned S3 audio file).

   * Transcribe WebSocket / sample repo helps with client streaming. ([GitHub][7])
3. Frontend: record microphone, send PCM to WebSocket, display interim transcript and final response, play returned audio and pass audio to the avatar for lip-sync.

**Deliverable:** two-way voice chat where the agent answers questions from the PDF.

---

## Sprint 6 — 3D Avatar + lip-sync + UI polish

**Goal:** Replace the placeholder canvas with a talking 3D avatar that matches the TTS audio (lip-sync) and displays facial expressions.

**Tasks**

1. Avatar model: use a GLTF/GLB humanoid model (Mixamo, Ready Player ME, or a generated avatar). Host model files on S3.
2. Renderer: use `three.js` (client-side WebGL) to render the avatar inside the browser. Load the GLTF and the animation skeleton. (This keeps compute client-side and reduces infra cost.)
3. Lip-sync approaches:

   * **Simpler:** run audio through WebAudio API to extract amplitude & beat and map to basic mouth open/close and eyebrow animations.
   * **Better:** use phoneme extraction (server-side or client-side) to compute visemes and play corresponding blendshape animations. If you use Nova Sonic, it may return phoneme/viseme metadata — check the model’s response schema. ([AWS Documentation][8])
4. Add expression triggers: smile when positive sentiment, nod on confirmations. Use the model’s response metadata or run a quick classifier on the text.
   **Deliverable:** Avatar speaks the reply audio, mouth moves in sync, PDF highlights shown.

---

## Sprint 7 — Robustness, context & memory, safety

**Goal:** Add multi-turn memory, error handling, guardrails, and logging for the demo.
**Tasks**

1. Session memory: store last N Q/A pairs in DynamoDB (or a Redis/Cache) and include that context in prompts.
2. Guardrails: apply system-level guardrails in Bedrock prompts (or use Bedrock prompt management / guardrail features). ([AWS Documentation][9])
3. Observability: CloudWatch logs, X-Ray or tracing, budget/quotas alarms.
4. Add fallback modes: offline text-only if speech fails, or show “I’m unsure — show sources” option.

---

## Sprint 8 — Deployment, CI/CD, hackathon polish & demo

**Goal:** Finalize CI, deploy to demo domain, prepare a short demo script and slides.
**Tasks**

1. CI: GitHub Actions — build frontend, deploy to S3 + CloudFront; deploy backend with SAM/CDK or serverless framework (pack and update Lambda); run unit tests.
2. Costs: set an AWS Budget with alerts for your account (very important).
3. Demo script (3–4 short tasks): upload sample PDF, ask 3 targeted questions, show avatar answers + highlighted references, demonstrate interruption & re-asking.
4. Prep slides, backup plan (if Nova Sonic quota blocked, switch to Transcribe+Polly flow).
   **Deliverable:** stable demo flow with fallback scenario and cost guardrails.

---

# Concrete code snippets & CLI samples you can drop in

### 1) Create GitHub repo (gh CLI)

```bash
gh repo create your-org/ai-agent --public --confirm
git remote add origin git@github.com:your-org/ai-agent.git
git push -u origin dev
```

### 2) Presigned S3 upload (Python boto3)

```python
import boto3, os
s3 = boto3.client('s3')
BUCKET = os.environ['PDF_BUCKET']

def create_presign(key, expires=3600):
    return s3.generate_presigned_url('put_object', Params={'Bucket': BUCKET, 'Key': key}, ExpiresIn=expires)
```

### 3) Bedrock invoke via AWS CLI (example)

(Use this pattern to call a text foundation model; adapt to converse or streaming per model docs.)

```bash
aws bedrock-runtime invoke-model \
  --model-id amazon.titan-text-express-v1 \
  --body '{"inputText":"Summarize the following: ..."}' \
  --cli-binary-format raw-in-base64-out \
  output.txt
```

(See Bedrock examples / InvokeModel docs.) ([AWS Documentation][4])

### 4) Polly synthesize (Python)

```python
import boto3
polly = boto3.client('polly')
resp = polly.synthesize_speech(VoiceId='Aditi', OutputFormat='mp3', Text="Hello from the AI agent")
with open('/tmp/out.mp3','wb') as f:
    f.write(resp['AudioStream'].read())
```

(Polly docs / Boto3 examples.) ([AWS Documentation][6])

### 5) Transcribe streaming: pointer

For browser → Transcribe streaming you typically use a WebSocket/HTTP2 streaming endpoint and stream PCM audio frames. See Amazon Transcribe streaming docs and example repos (they provide a static site sample). ([AWS Documentation][5])

---

# What to select in the AWS “Search and select resources (manual)” UI — exact picks

When the console asks that question, search for and add these resources (create new where appropriate):

* **Amazon S3** — create two buckets: PDFs and frontend assets.
* **AWS Lambda** — create functions: `presign_upload`, `s3_ingest_trigger`, `bedrock_proxy`. Runtime: Python 3.11.
* **Amazon API Gateway** — HTTP API for control endpoints; **API Gateway WebSocket** if you plan to stream audio via WebSocket.
* **Amazon Cognito** — User Pool (app client).
* **Amazon DynamoDB** — table `ai_sessions`.
* **Amazon Kendra** (or Amazon OpenSearch Service / serverless vector DB) — create an index or domain for semantic search. ([AWS Documentation][2])
* **IAM Roles** — Lambda execution roles and a Bedrock invoke role (policy to allow `bedrock:InvokeModel`).
* **Amazon Bedrock** — if available in your account/region, add Bedrock runtime access (you may need to request quota access). ([AWS Documentation][4])
* **Amazon ECS / Fargate** — *optional*, if you will host an avatar renderer on the server (prefer client-side).
* **CloudFront** — optional, for frontend CDN.
* **CloudWatch** — enable logs and alarms.
* **AWS Budgets** — create budget alert to avoid surprises.

*Note:* Bedrock / Nova Sonic access may require account-level permissions or region availability. If Nova Sonic is available, prefer it for streaming voice (low latency and less plumbing). ([Amazon Web Services, Inc.][1])

---

# Honest caveats & “tell it like it is”

* **Nova Sonic is the easiest voice path if you can access it** — it unifies speech-in / speech-out and lowers latency, but you may need to request access or be in supported regions. ([Amazon Web Services, Inc.][1])
* **Avatar lip-sync is fiddly** — getting natural mouth shapes needs either phonemes (best) or a pragmatic amplitude-based solution (good-enough for a demo). Don’t underestimate this sprint.
* **Cost** — Bedrock (and Nova Sonic) can be expensive in heavy usage. Add budgets and test on small samples.
* **Quotas & region availability** — Bedrock models, Nova Sonic, and Kendra availability differ by region. If you hit a block, switch to Transcribe+Polly+OpenSearch fallback. ([AWS Documentation][3])

---

# Immediate next actions (what I’d do if I were you right now)

1. Create GitHub repo and project board (Sprint 0).
2. In AWS Console: create the two S3 buckets + Cognito user pool + minimal Lambda role (Sprint 1).
3. Implement `presign_upload` + minimal React upload UI and confirm upload flow works (Sprint 2–3).
4. Pick Kendra vs OpenSearch vector approach now — Kendra if you want managed semantic search; OpenSearch if you want vector control. (If unsure: start with Kendra for quicker Q/A results.) ([AWS Documentation][2])

---