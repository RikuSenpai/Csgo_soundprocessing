function RefreshSomeEventListener() {
	// Remove handler from existing elements
	$("#wrapper .specific-selector").off();

	// Re-add event handler for all matching elements
	$("#wrapper .specific-selector").on("click", function () {
		// Handle event.
	});
}

function arrayBufferToBase64(buffer) {
	var binary = '';
	var bytes = new Uint8Array(buffer);
	var len = bytes.byteLength;
	for (var i = 0; i < len; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return window.btoa(binary);
}

function create_audio(audio_binary, i) {
	bin = audio_binary.bin;
	name = audio_binary.name.split('.')[0];
	var base64EncodedStr = arrayBufferToBase64(bin);
	$('#main').append('<div class="audio" id=div' + name + '><div>')
	$('#div' + name).append('<h4>' + name + '<h4>');
	$('#div' + name).append('<audio controls id=aud' + name + '></audio>');
	$('#aud' + name).append('<source src="data:audio/wav;base64,' + base64EncodedStr + '" />');

	$('#div' + name).append('<button type="button" class="yesBtn" id="butyes' + name + '">YES</button>');
	$('#div' + name).append('<button type="button" class="noBtn" id="butno' + name + '">NO</button>');

	RefreshSomeEventListener();
}

$(document).ready(() => {
	RefreshSomeEventListener();
	var socket = io();

	$('h1').text('Loading some audio please wait')

	socket.on('audio', (audio_binaries, csv_data) => {
		vote = csv_data;
		$('h1').text('Tell if you can hear footsteps');
		for (let i = 0; i < audio_binaries.length; i++) {
			const element = audio_binaries[i];
			create_audio(element, i);
		}
	});

	socket.on('wait', () => {
		setTimeout(() => {
			socket.emit('areurdy');
		}, 2);
	});

	socket.on('timeout', (n) => {
		alert('you have been timed out, don\'t spam the request button ! Try again in ' + parseInt(n) + ' seconds !');
		setTimeout(()=>{
			socket.emit('apologize');
			$('#req').prop('disabled', false);
		}, n*1000);

		$('#req').prop('disabled', true);
	});

	$('body').on('click', 'button.yesBtn', (event) => {
		name = event.target.id.split('butyes')[1] + '.wav';
		let id = event.target.id;
		$('#' + id).parent().remove();
		socket.emit('vote+', name);

	});

	$('body').on('click', 'button.noBtn', (event) => {
		let name = event.target.id.split('butno')[1] + '.wav';
		let id = event.target.id;
		$('#' + id).parent().remove();
		socket.emit('vote-', name);

	});

	$('#req').on('click', (event) => {
		socket.emit('request_new_data');
		$('#main').empty();
		$('#main').append('<h1>Loading some audio please wait</h1>');
	});
});