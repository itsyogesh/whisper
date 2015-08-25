var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    users = {},
    mongoose = require('mongoose');

mongoose.connect('localhost:27017/whisper');
console.log('connected to mongodb');

var chatSchema = mongoose.Schema({
	nick : {type: String},
	msg : {type: String},
	created: {type: Date, default: Date.now}
});

var Chat = mongoose.model('Message', chatSchema);

server.listen(3000);

app.get('/', function(req, res){
	res.sendfile(__dirname + '/index.html');
});

io.sockets.on('connection', function(socket){
	var query = Chat.find({});

	query.sort('-created').limit(10).exec(function(err, data){
		if(err){
			console.log(err);
		}
		socket.emit('load old messages', data);
	});

	socket.on('new user', function(data, callback){
		if(data in users){
			callback(false);
		}
		else{ 
			callback(true);
			socket.nickname = data;
			users[socket.nickname] = socket;
			
			updateNicknames();
		}
	});

	function updateNicknames(){
		io.sockets.emit('usernames', Object.keys(users));
	}

	socket.on('disconnect', function(data){
		if(!socket.nickname) return;
		delete users[socket.nickname];
		updateNicknames();
	});

	socket.on('send message', function(data, callback){
		var msg = data.trim();
		if(msg.substr(0, 3) === '/w '){
			console.log(msg);
			msg = msg.substr(3);
			var ind = msg.indexOf(' ')
			if(ind !== -1){
				var name = msg.substr(0, ind);
				var msg = msg.substr(ind + 1);
				console.log(Object.keys(users));
				console.log(name);
				if(name in users){
					users[name].emit('whisper', {msg: msg, name: socket.nickname});
				} else {
					callback('Error! enter a valid user');
				}
				console.log('whisper');
			}
			else {
				callback('Error! please mention a message for whisper')
			}
		}
		else {
			console.log(data);
			console.log(socket.nickname + ' : ' + data);
			//Saving to db
			var newMsg = new Chat({msg: msg, nick: socket.nickname});
			newMsg.save(function(err){
				if(err){
					console.log(err);
				}
				//Sending the message
				io.sockets.emit('new message', {msg: data, name: socket.nickname});
			});
		}
	});
});

