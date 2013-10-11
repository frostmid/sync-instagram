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
			'url': 'http://statigr.am/' + entry.username,
			'entry-type': 'urn:fos:sync:entry-type/3292fd10321611e3be1c394bd9f8d2fc',
			'first-name': entry.full_name,
			'nickname': entry.username,
			'avatar': entry.profile_picture,
			'about': entry.bio,
			'site': entry.website
		}
	},

	'tag': function (entry) {
		return {
			'url': 'http://statigr.am/tag/' + entry.tag,
			'entry-type': 'urn:fos:sync:entry-type/c9256fb0321611e3be1c394bd9f8d2fc'
			'title': entry.tag
		}
	},

	'image': function (entry) {
		return {
			'url': 'http://statigr.am/p/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/93b79c40321611e3be1c394bd9f8d2fc',
			'author': 'http://statigr.am/' + entry.user.username,
			'content': (entry.caption && entry.caption.text) ? entry.caption.text : null,
			'created_at': entry.created_time,
			'attached': {
				'photos': [entry.images.thumbnail.url]
			},
			'metrics': {
				'comments': entry.comments.count,
				'likes': entry.likes.count
			}
			//'show-url': entry.link
		}
	},

	'video': function (entry) {
		return {
			'url': 'http://statigr.am/p/' + entry.id,
			'entry-type': 'urn:fos:sync:entry-type/28dd0a60326411e38d94a7656a4e4a0a',
			'author': 'http://statigr.am/' + entry.user.username,
			'content': (entry.caption && entry.caption.text) ? entry.caption.text : null,
			'created_at': entry.created_time,
			'attached': {
				'video': [entry.videos.standard_resolution.url]
			},
			'metrics': {
				'comments': entry.comments.count,
				'likes': entry.likes.count
			}
			//'show-url': entry.link
		}
	},

	'comment': function (entry) {
		return {
			'entry-type': 'urn:fos:sync:entry-type/dd161c90321611e3be1c394bd9f8d2fc',
			'author': 'http://statigr.am/' + entry.from.username,
			'ancestor': 'http://statigr.am/p/' + entry.ancestor,
			'content': entry.text || null,
			'created_at': entry.created_time
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
	.use ('urn:fos:sync:feature/8086b260321511e3be1c394bd9f8d2fc', function getUserProfile (task) {
		var token = task._prefetch.token;

		var preEmit = function (entry) {
			entry.tokens = [token._id];
			return entry;
		};

		return instagram (this, task, preEmit).getUserProfile (task.url);
	})

	.use ('urn:fos:sync:feature/e0e67af0321511e3be1c394bd9f8d2fc', function getMediaByTag (task) {
		return instagram (this, task).getMediaByTag (task.url);	
	})

	.use ('urn:fos:sync:feature/fb1b28d0321511e3be1c394bd9f8d2fc', function getMediaByUser (task) {
		return instagram (this, task).getMediaByUser (task.url);	
	})

	.use ('urn:fos:sync:feature/ea86b3c0326c11e38d94a7656a4e4a0a', function getMedia (task) {
		return instagram (this, task).getMedia (task.url);	
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