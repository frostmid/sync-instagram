process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var	_ = require ('lodash'),
	Promises = require ('vow'),
	SocketIO = require ('socket.io-client'),
	Slave = require ('fos-sync-slave'),
	Instagram = require ('./libs/instagram'),
	url = process.argv [2] || 'http://127.0.0.1:8001';


var parse = {
	'user': function (entry) {
		if (entry.profile_picture.match(/anonymousUser\.jpg$/)) {
			entry.profile_picture = null;
		}

		return {
			'url': 'https://www.instagram.com/' + entry.username + '#' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/3292fd10321611e3be1c394bd9f8d2fc',
			'first-name': entry.full_name,
			'nickname': entry.username,
			'avatar': entry.profile_picture,
			'about': entry.bio,
			'site': entry.website
		}
	},


	'photo': function (entry) {
		return {
			'entry-type': 'urn:fos:sync:entry-type/93b79c40321611e3be1c394bd9f8d2fc'
		}
	},

	'tag': function (entry) {
		return {
			'entry-type': 'urn:fos:sync:entry-type/c9256fb0321611e3be1c394bd9f8d2fc'
		}
	},

	'comment': function (entry) {
		return {
			'entry-type': 'urn:fos:sync:entry-type/dd161c90321611e3be1c394bd9f8d2fc'
		}
	}
};

function instagram (slave, task, preEmit) {
	return new Instagram ({
		accessToken: task._prefetch.token.access_token,
		emit: function (entry) {
			if (preEmit) {
				entry = preEmit (entry);
			}
			
			return slave.emitter (task).call (this, entry);
		},
		scrapeStart: task['scrape-start'],
		parse: parse
	})
};


(new Slave ({
	title: 'instagram api',
	version: '0.0.1'
}))
	.use ('urn:fos:sync:feature/8086b260321511e3be1c394bd9f8d2fc', function getUser (task) {
		var token = task._prefetch.token;

		var preEmit = function (entry) {
			entry.tokens = [token._id];
			return entry;
		};

		return instagram (this, task, preEmit).getUser (task.url);
	})

	.use ('urn:fos:sync:feature/e0e67af0321511e3be1c394bd9f8d2fc', function getTagPhotos (task) {
		return instagram (this, task).getTagPhotos (task.url);	
	})

	.use ('urn:fos:sync:feature/fb1b28d0321511e3be1c394bd9f8d2fc', function getProfilePhotos (task) {
		return instagram (this, task).getProfilePhotos (task.url);	
	})

	.use ('urn:fos:sync:feature/cf8e0520321511e3be1c394bd9f8d2fc', function reply (task) {
		return null;	
	})

	.use ('urn:fos:sync:feature/bba595a0321511e3be1c394bd9f8d2fc', function explain (task) {
		return null;	
	})

	.fail (function (error) {
		console.error ('Error', error);

		var reconnect = _.bind (function () {
			this.connect (SocketIO, url)
		}, this);
		
		_.delay (reconnect, 1000);
	})

	.connect (SocketIO, url);