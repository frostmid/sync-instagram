var	_ = require ('lodash'),
	Q = require ('q'),
	Promises = require ('vow'),
	request = require ('fos-request');

module.exports = function Instagram (settings) {
	this.settings = _.extend ({}, this.settings, settings);
	this.entry = _.bind (this.entry, this);
};

_.extend (module.exports.prototype, {
	settings: {
		base: 'https://api.instagram.com/v1',
		accessToken: null,
		emit: null,
		scrapeStart: null
	},

	request: function (url) {
		if (!url) {
			throw new Error ('Request requires url to request: ' + url);
		}

		return request (url);
	},

	get: function (endpoint) {
		var url = this._appendToken (this.settings.base + endpoint);

		return this.request (url)
			.then(function (entry) {
				return entry.data;
			});
	},

	list: function (endpoint, iterator) {
		var self = this;

		var fetchMore = _.bind (function (url) {
			return this.request (url)
				.then (process);
		}, this);

		var process = function (results) {
			var promises = [];

			if (results.error) {
				throw results.error;
			}

			if (results.data) {
				promises = _.map (
					_.filter (results.data, function (entry) {
						var created_time = entry.created_time ? ((new Date (entry.created_time)).getTime ()) : null,
							scrapeStart = self.settings.scrapeStart;

						return (created_time && scrapeStart && (created_time >= scrapeStart));
					}),
					iterator
				);
			}

			if (results.pagination && results.pagination.next_url) {
				promises.push (
					fetchMore (results.pagination.next_url)
				);
			}

			return Q.all (promises);
		};

		return this.get (endpoint)
			.then (process);
	},

	post: function (endpoint, data) {
		var url = this._appendToken (this.settings.base + endpoint);
		return this.request ({
			url: url,
			method: 'post',
			form: data
		});	
	},

	entry: function (entry, type) {
		var type = type ? type : (entry.type || null),
			parser = this.settings.parse [type],
			parsed;

		entry.id = entry.object_id ? entry.object_id : entry.id;

		if (typeof parser == 'function') {
			try {
				parsed = parser.call (this, entry);
			} catch (e) {
				console.error ('Failed to parse entry', e.message, entry);
				throw e;
			}

			console.log('* emit', parsed.url);
			
			return Q.when (parsed)
				.then (this.settings.emit)
				.fail (function (error) {
					console.log ('Failed to emit entry', error, entry);
				})
				.done ();

		} else {
			console.log ('Skipping', entry.id, 'of unknown type', type);
		}
	},

	_appendToken: function (url) {
		var q = (url.indexOf ('?') === -1) ? '?' : '&';

		return url + q +
			'access_token=' + this.settings.accessToken +
			'&regionId=' + this.settings.locale;
	},

	_getUserEntry: function (url) {
		var self = this,
			tmp = url.match (/statigr\.am\/(\w+)\/?/),
			userId = tmp ? tmp [1] : 'self';

		if (userId != 'self') {
			return self.get ('/users/search?q=' + userId)
				.then (function (results) {
					return _.find(results, function (item) {
						return item.username == userId;
					});
				})
				.then (function (entry) {
					return self.get ('/users/' + entry.id);
				}); 
		}

		return self.get ('/users/' + userId);
	},

	getUserProfile: function (url) {
		var self = this;

		return self._getUserEntry (url)
			.then (function (entry) {
				return Promises.when (self.entry (entry, 'user'));
			});
	},

	getMediaByUser: function (url) {
		var self = this;

		return self._getUserEntry (url)
			.then (function (user) {
				return self.list ('/users/' + user.id + '/media/recent', function (entry) {
					return Promises.all ([
						self.entry (entry),
						self.getComments (entry)
					]);
				});
			});
	},

	getMediaByTag: function (url) {
		var self = this,
			tmp = url.match (/\/tag\/(\w+)\/?/),
			tagName = tmp ? tmp [1] : null;

		return self.list ('tags/' + tagName + '/media/recent', function (entry) {
			return Promises.all ([
				self.entry (entry),
				self.getComments (entry)
			]);
		});
	},

	getComments: function (entry) {
		var self = this;

		return self.list ('/media/' + etry.id + '/comments', function (item) {
			item.ancestor = entry.id;

			return self.entry (item, 'comment');
		});
	}

});