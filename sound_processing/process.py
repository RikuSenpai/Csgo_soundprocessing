import librosa
import pyaudio
import numpy as np


class SoundProcessor(object):
	def __init__(self, sr: int = 22050, mono: bool = True):
		self.mono = mono
		self.sr = sr

		self._player = pyaudio.PyAudio()

	def _load_sound(self, file: str):
		self.y, _ = librosa.load(file, sr=self.sr, mono=self.mono)

	def _save_sound(self, sound: list, file: str):
		librosa.output.write_wav(file, sound, self.sr)

	def audio_to_spectrogram(self, file: str, hop_length: int = None):
		self._load_sound(file)
		if self.mono:
			return librosa.stft(self.y, hop_length=hop_length)
		else:
			tmp = list()
			for y in self.y:
				tmp.append(librosa.stft(y, hop_length=hop_length))
			return tmp

	def spectrogram_to_audio(self, spectrogram: list, file: str = 'audio.wav', hop_length: int = None):
		audio = librosa.istft(stft_matrix=spectrogram, hop_length=hop_length)
		self._save_sound(audio, file)

	def split_audio(self, split_length: int, file: str):
		self._load_sound(file)
		if split_length == 0:
			return [self.y]

		duration = librosa.get_duration(self.y)

		frames = list()
		for i in np.arange(0, duration, split_length):
			frame_start = i * self.sr
			if i + split_length < duration:
				frame_end = (i+split_length) * self.sr
			else:
				frame_end = duration
			frames.append(self.y[int(frame_start): int(frame_end)])
		return frames

	def play(self, audio: list):
		audio  = (audio*32768).astype(np.int16) # scale to int16 for sound card
		bytestream = audio.tobytes()

		stream = self._player.open(format=pyaudio.paInt16, channels=1, rate=44100, output=True, output_device_index=4)
		stream.write(bytestream)
		stream.stop_stream()
		stream.close()

	def spectrograms_to_data(self, spectrograms: list):
		#not tested
		dim1 = len(spectrograms)

		tmp = spectrograms[0].reshape(1, -1)
		dim2 = len(tmp)

		data = np.zeros((dim1, dim2))
		for i, spec in enumerate(spectrograms):
			tmp = spec.reshape(1, -1)  # 2d to 1d
			data[i] = tmp

		return data
