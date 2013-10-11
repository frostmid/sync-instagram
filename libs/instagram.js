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
		showbase: 'http://statigr.am',
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


	getUser: function (url) {
		var self = this;

		return this.get ('/users/' + 502187218)
			.then (function (entry) {
				return Promises.when (self.entry (entry, 'user'));
			});
	},

	getTagPhotos: function (url) {
		var self = this;

		//TODO
		return null;
	},

	getProfilePhotos: function (url) {
		var self = this;

		//TODO
		return null;
	}

});