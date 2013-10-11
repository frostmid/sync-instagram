function (url, callback) {
	
  	if (! url.match(/(instagram\.com|statigr\.am)/)) return;
  
  	callback (url);

  	if (url.match (/e/)) {
  		return ['urn:fos:sync:feature/fb1b28d0321511e3be1c394bd9f8d2fc'];
  	} else {
  		
  	}
};