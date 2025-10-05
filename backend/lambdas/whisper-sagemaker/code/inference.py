import torch # type: ignore
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline # type: ignore

# Model and task specifications
model_id = "openai/whisper-large-v3"
task = "automatic-speech-recognition"

# Device configuration
device = "cuda:0" if torch.cuda.is_available() else "cpu"
torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

def model_fn(model_dir):
    # Load the model
    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        model_id, torch_dtype=torch_dtype, low_cpu_mem_usage=True, use_safetensors=True
    )
    model.to(device)

    # Load the processor
    processor = AutoProcessor.from_pretrained(model_id)

    # Create and return a pipeline for ASR
    asr_pipeline = pipeline(
        task,
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        return_timestamps=True,
        torch_dtype=torch_dtype,
        device=device,
    )
    return asr_pipeline