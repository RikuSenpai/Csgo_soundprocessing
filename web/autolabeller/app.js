//Import Packages
const express = require("express");
const path = require("path");
const fs = require('fs');
const csv = require('csv-parser');
const Dropbox = require('dropbox').Dropbox;
require('dotenv').config();
require('isomorphic-fetch'); // or another library of choice.

let app = express();
const server = require("http").Server(app);
const io = require("socket.io").listen(server);

const port = 8081;

let data_is_ready = false;

//Server
app.set("port", (process.env.PORT) || port);

app.use(express.static(__dirname + "/public"));
app.use("/public", express.static(__dirname + "/public"));

//ROUTES

app.get("/", (req, res) => {
	res.sendFile(path.join(__dirname + "/public/index.html"));
});

let data = {};
let server_ready = false;

server.listen(app.get("port"), () => {
	console.log("express started at port: ", app.get("port"));
	getCsv((a, fulldata) => {
		data = fulldata;
		console.log('server ready');
		server_ready = true;

	});
});


function readCsv(nb_sounds, callback) {
	let csv_data = {};
	let names = new Array();

	fs.createReadStream('./labels.csv')
		.pipe(csv({
			separator: ';'
		}))
		.on('data', function (data) {
			try {
				isFootsteps = parseInt(data[' footsteps']);
				isNotFootsteps = parseInt(data[' no'])


				if (Math.abs(isFootsteps - isNotFootsteps) < 3) {
					csv_data[data.filename] = {
						yes: isFootsteps,
						no: isNotFootsteps
					};
					names.push(data.filename);
				}

				//perform the operation
			} catch (err) {
				//error handler
				console.log(err);

			}
		})
		.on('end', function () {
			let copy_csv_data = JSON.parse(JSON.stringify(csv_data));
			let wanted = names.sort(() => .5 - Math.random()).slice(0, nb_sounds);
			for (let i = 0; i < names.length; i++) {
				const element = names[i];
				if (!wanted.includes(element)) {
					delete csv_data[element];
				}
			}
			callback(csv_data, copy_csv_data);
		});
}

async function asyncForEach(array, callback) {
	for (let index = 0; index < array.length; index++) {
		await callback(array[index], index, array);
	}
}

function getAudioFiles(csv_data, callback) {
	var dbx = new Dropbox({
		accessToken: process.env.DROPBOX_API_TOKEN
	});

	files = Object.keys(csv_data);
	const start = async () => {
		let binaries = []
		await asyncForEach(files, async (element) => {
			console.log('/Not_Labeled/' + element);

			await dbx.filesDownload({
					path: '/Not_Labeled/' + element
				})
				.then(function (response) {
					binary = response.fileBinary;
					binaries.push({
						bin: binary,
						name: response.name
					})
				})
				.catch(function (error) {
					console.log(error);
				});

		});
		callback(binaries);
	}

	start();
}

function getCsv(callback) {
	var dbx = new Dropbox({
		accessToken: process.env.DROPBOX_API_TOKEN
	});
	dbx.filesDownload({
			path: '/labels.csv'
		})
		.then(function (response) {
			console.log(response);
			binary = response.fileBinary;

			fs.writeFile('./labels.csv', binary, (err) => {
				if (err) {
					console.log(err);
				} else {
					console.log('File successfully written !');
					readCsv(10, (data, fulldata) => {
						callback(data, fulldata);
					});
				}
			});
		})
		.catch(function (error) {
			console.log(error);
		});
}

function upload_csv(csv_data, callback) {
	var dbx = new Dropbox({
		accessToken: process.env.DROPBOX_API_TOKEN
	});

	keys = Object.keys(csv_data);

	csv_file = 'filename; footsteps; no\n';

	for (let i = 0; i < keys.length; i++) {
		const element = keys[i];
		csv_file = csv_file + element + '; ' + csv_data[element].yes.toString() + '; ' + csv_data[element].no.toString() + '\n';
	}

	dbx.filesUpload({
			path: "/labels.csv",
			contents: csv_file,
			mode: 'overwrite'
		})
		.then(function (response) {
			console.log(response);
			callback();
		})
		.catch(function (error) {
			console.error(error);
		});
}

io.on("connection", (socket) => {
	console.log("user " + socket.id + " connected !");
	let data_for_voter = {};
	let binaries = {};

	if (server_ready) {
		getCsv((csv_data, b) => {
			getAudioFiles(csv_data, (audio_binaries) => {
				data_is_ready = true;
				binaries = audio_binaries;
				socket.emit('audio', binaries, data_for_voter);
			});
			data_for_voter = csv_data;
		});
	} else {
		socket.emit('wait');
	}

	socket.on('areurdy', () => {
		if (server_ready) {
			getCsv((csv_data, b) => {
				getAudioFiles(csv_data, (audio_binaries) => {
					data_is_ready = true;
					binaries = audio_binaries;
					socket.emit('audio', binaries, data_for_voter);
				});
				data_for_voter = csv_data;
			});
		} else {
			socket.emit('wait');
		}
	});

	socket.on("vote-", (audioname) => {
		data[audioname].no += 1;
	});

	socket.on("vote+", (audioname) => {
		data[audioname].yes += 1;
	});

	socket.on("request_new_data", () => {
		upload_csv(data, () => {
			getCsv((csv_data, b) => {
				getAudioFiles(csv_data, (audio_binaries) => {
					data_is_ready = true;
					binaries = audio_binaries;
					socket.emit('audio', binaries, data_for_voter);
				});
				data_for_voter = csv_data;
			});
		});
	});

	socket.on('disconnect', () => {
		upload_csv(data, () => {
			console.log('user disconnected, data uploaded');
		});
	});

});