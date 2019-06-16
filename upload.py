from sound_processing.process import SoundProcessor
import dropbox
import argparse
import os
import datetime
import csv


def setup_parser():
	parser = argparse.ArgumentParser()
	parser.add_argument('token', help='acces token for dropbox api')
	parser.add_argument('sound', help='the audio file to upload')
	parser.add_argument(
		'-s', '--split', help='the split length (default=3)', type=float, default=3)
	parser.add_argument(
		'-d', '--dir', help='the directory for temporary files', default='./tmp_upload')
	return parser


def get_filename():
	dt = datetime.datetime.today()
	return '{}{}{}{}{}_csgo'.format(dt.day, dt.month, dt.year, dt.hour, dt.minute)


def download_csv(dbx, tmp_dir: str):
	filename = 'labels.csv'
	dbx.files_download_to_file(tmp_dir+filename, '/' + filename)


def append_csv_and_upload(dbx, tmp_dir: str, audiofile: str, upload: bool = True):
	filename = 'labels.csv'
	with open(tmp_dir+filename, 'a') as f:
		row = '\n{}; 0; 0'.format(audiofile)
		f.write(row)

	# upload
	if upload:
		try:
			with open(tmp_dir + filename, 'rb') as f:
				dbx.files_upload(
					f.read(), '/{}'.format(filename), mode=dropbox.files.WriteMode.overwrite)
		except Exception as err:
			print('[{}] failed to upload |'.format(i), err)
		print(dbx.files_get_metadata(
			'/{}'.format(filename)).server_modified)
		os.remove(tmp_dir + filename)


if __name__ == "__main__":
	parser = setup_parser()
	args = parser.parse_args()

	tmp_dir = args.dir + os.sep

	# create temporary directory for audio splits if it doesnt exists
	if not os.path.isdir(tmp_dir):
		os.mkdir(tmp_dir)

	# connect to dropbox
	dbx = dropbox.Dropbox(args.token)

	# dowload labels csv file
	download_csv(dbx, tmp_dir)

	filename = get_filename()

	processor = SoundProcessor()

	# Create audio splits
	print('splitting audio ...')
	audio_splits = processor.split_audio(
		split_length=args.split, file=args.sound)
	for i, split in enumerate(audio_splits):
		processor._save_sound(split, tmp_dir +
							  '{}_{}.wav'.format(filename, i))

	print('audio splitted')

	# Upload to dropbox
	print('uploading splits ...')
	files = os.listdir(tmp_dir)
	failed = True
	while failed:
		for i, audiofile in enumerate(files):
			if audiofile != 'labels.csv':
				try:
					with open(tmp_dir + audiofile, 'rb') as f:
						dbx.files_upload(
							f.read(), '/Not_Labeled/{}'.format(audiofile))
					print(dbx.files_get_metadata(
						'/Not_Labeled/{}'.format(audiofile)).server_modified)
					append_csv_and_upload(dbx, tmp_dir, audiofile,
										(i+1 == len(files)-1))
					os.remove(tmp_dir + audiofile)
					failed = False
				except Exception as err:
					print('[{}] failed to upload |'.format(i), err)
					failed = True

	# Cleaning
	os.rmdir(tmp_dir)

	print('Everything was uploaded with success, goodbye.')
