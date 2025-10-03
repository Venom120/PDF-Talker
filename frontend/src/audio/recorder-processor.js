class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.port.onmessage = (event) => {
      if (event.data.type === 'stop') {
        // Handle stop message if needed
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (input.length > 0) {
      const pcmData = new Int16Array(input[0].length);
      for (let i = 0; i < input[0].length; i++) {
        pcmData[i] = input[0][i] * 32767;
      }
      this.port.postMessage({ type: 'audioData', pcmData: pcmData.buffer }, [pcmData.buffer]);
    }
    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);