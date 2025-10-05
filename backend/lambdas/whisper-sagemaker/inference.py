import torch # type: ignore
from transformers import AutoModelForSpeechSeq2Seq, AutoProcessor, pipeline # type: ignore

def model_fn(model_dir):
    """
    Loads the model and processor from the specified directory.
    The SageMaker container will have already downloaded the model files to model_dir.
    """
    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    torch_dtype = torch.float16 if torch.cuda.is_available() else torch.float32

    # Load the model directly from the local directory
    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        model_dir, torch_dtype=torch_dtype, low_cpu_mem_usage=True, use_safetensors=True
    )
    model.to(device)

    # Load the processor from the local directory
    processor = AutoProcessor.from_pretrained(model_dir)

    # Create and return a pipeline for ASR
    asr_pipeline = pipeline(
        "automatic-speech-recognition",
        model=model,
        tokenizer=processor.tokenizer,
        feature_extractor=processor.feature_extractor,
        return_timestamps=True,
        torch_dtype=torch_dtype,
        device=device,
    )
    return asr_pipeline