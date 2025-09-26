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
