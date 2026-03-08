# Plan: Remotion Lambda & Telegram Migration

This plan details the migration of video rendering from local Docker workers to AWS Lambda using the Remotion Lambda distributed rendering engine. It also adds Telegram notifications for final video delivery.

## Phase 1: Infrastructure & AWS Setup

### [1.1] AWS Configuration
- **Provision IAM User**: Create a dedicated IAM user with `AmazonS3FullAccess` and `AWSLambdaFullAccess`.
- **S3 Bucket**: Use the existing `S3_BUCKET_NAME` for project assets and Lambda payloads.

### [1.2] Remotion Site Deployment
- **Lambda Functions**: Deploy Remotion Lambda functions to AWS using `npx remotion lambda functions deploy`.
- **Remotion Site**: Bundle and deploy the Remotion project to S3 using `npx remotion lambda sites create`.

### [1.3] Telegram Bot Setup
- **Bot Creation**: Obtain a Telegram Bot Token via `@BotFather`.
- **Chat ID**: Retrieve the target `CHAT_ID` for notifications.

## Phase 2: Configuration & Dependencies

### [2.1] Python Environment
- **Update [requirements.txt](file:///d:/Projects/Crownmercado/crownmercado-automation-dev/requirements.txt)**:
    - Add `remotion-lambda`
    - Add `python-telegram-bot`
- **Update [settings.py](file:///d:/Projects/Crownmercado/crownmercado-automation-dev/src/shared/config/settings.py)**:
    - Add `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.
    - Add `REMOTION_LAMBDA_SERVE_URL`, `REMOTION_LAMBDA_FUNCTION_NAME`, `REMOTION_LAMBDA_REGION`.

## Phase 3: Adapter Implementation

### [3.1] [NEW] [RemotionLambdaRenderer](file:///d:/Projects/Crownmercado/crownmercado-automation-dev/src/modules/video_processing/infrastructure/adapters/remotion_lambda_renderer.py)
- Implement `IRenderEnginePort`.
- Use `render_media_on_lambda` from the `remotion-lambda` SDK.
- Handle state polling for completion or webhook integration.

### [3.2] [NEW] [TelegramAdapter](file:///d:/Projects/Crownmercado/crownmercado-automation-dev/src/modules/notifications/infrastructure/adapters/telegram_adapter.py)
- Use `python-telegram-bot` to send messages.
- Function to generate S3 presigned links and send them as clean Telegram messages.

## Phase 4: Pipeline Integration

### [4.1] Update [pipeline_tasks.py](file:///d:/Projects/Crownmercado/crownmercado-automation-dev/src/worker/pipeline_tasks.py)
- Integrate `RemotionLambdaRenderer` into the `render_remotion_task`.
- Add a final `send_notification_task` to the Celery chain after successful rendering.

## Phase 5: Verification

### [5.1] Functional Testing
- Trigger a render via the API/Frontend.
- Monitor AWS CloudWatch for Lambda execution.
- Verify Telegram receipt of the S3 link.

## Security & Maintenance
- **S3 Retention**: Configure S3 lifecycle rules for the `pipeline/` directory (e.g., auto-delete intermediate files after 7 days if cleanup fails).
- **Rate Limiting**: Telegram has rate limits; ensure only one notification per pipeline completion to avoid blocks.
