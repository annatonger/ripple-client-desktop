var rippleVaultClient =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	ripple = __webpack_require__(1);
	module.exports = __webpack_require__(2);

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = ripple;

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	var async      = __webpack_require__(8);
	var blobClient = __webpack_require__(3).BlobClient;
	var Blob       = __webpack_require__(3).Blob;
	var AuthInfo   = __webpack_require__(4).AuthInfo;
	var RippleTxt  = __webpack_require__(5).RippleTxt;
	var crypt      = __webpack_require__(6).Crypt;


	function VaultClient(opts) {
	  
	  var self = this;
	  
	  if (!opts) {
	    opts = { };
	  }

	  if (typeof opts === 'string') {
	    opts = { domain: opts };
	  }

	  this.domain   = opts.domain || 'ripple.com';
	  this.infos    = { };
	};

	/**
	 * getAuthInfo
	 * gets auth info for a username. returns authinfo
	 * even if user does not exists (with exist set to false)
	 * @param {string} username
	 * @param {function} callback
	 */
	VaultClient.prototype.getAuthInfo = function (username, callback) {

	  AuthInfo.get(this.domain, username, function(err, authInfo) {
	    if (err) {
	      return callback(err);
	    }

	    if (authInfo.version !== 3) {
	      return callback(new Error('This wallet is incompatible with this version of the vault-client.'));
	    }

	    if (!authInfo.pakdf) {
	      return callback(new Error('No settings for PAKDF in auth packet.'));
	    }

	    if (typeof authInfo.blobvault !== 'string') {
	      return callback(new Error('No blobvault specified in the authinfo.'));
	    }

	    callback(null, authInfo);
	  });  
	};

	/**
	 * _deriveLoginKeys
	 * method designed for asnyc waterfall
	 */

	VaultClient.prototype._deriveLoginKeys = function (authInfo, password, callback) {
	  var normalizedUsername = authInfo.username.toLowerCase().replace(/-/g, '');
	  
	  //derive login keys
	  crypt.derive(authInfo.pakdf, 'login', normalizedUsername, password, function(err, keys) {
	    if (err) {
	      callback(err);
	    } else {
	      callback(null, authInfo, password, keys);
	    }
	  });
	};



	/**
	 * _deriveUnlockKey
	 * method designed for asnyc waterfall
	 */

	VaultClient.prototype._deriveUnlockKey = function (authInfo, password, keys, callback) {
	  var normalizedUsername = authInfo.username.toLowerCase().replace(/-/g, '');
	  
	  //derive unlock key
	  crypt.derive(authInfo.pakdf, 'unlock', normalizedUsername, password, function(err, unlock) {
	    if (err) {
	      console.log('error', 'derive:', err);
	      return callback(err);
	    }

	    if (!keys) {
	      keys = { };
	    }
	    
	    keys.unlock = unlock.unlock;
	    callback(null, authInfo, keys);
	  });
	};
	  
	/**
	 * Get a ripple name from a given account address, if it has one
	 * @param {string} address - Account address to query
	 * @param {string} url     - Url of blob vault
	 */

	VaultClient.prototype.getRippleName = function(address, url, callback) {
	  //use the url from previously retrieved authInfo, if necessary
	  if (!url) {
	    callback(new Error('Blob vault URL is required'));
	  } else {
	    blobClient.getRippleName(url, address, callback);
	  }
	};

	/**
	 * Check blobvault for existance of username
	 *
	 * @param {string}    username
	 * @param {function}  fn - Callback function
	 */

	VaultClient.prototype.exists = function(username, callback) {
	  AuthInfo.get(this.domain, username.toLowerCase(), function(err, authInfo) {
	    if (err) {
	      callback(err);
	    } else {
	      callback(null, !!authInfo.exists);
	    }
	  });
	};

	/**
	 * Check blobvault for existance of address
	 *
	 * @param {string}    address
	 * @param {function}  fn - Callback function
	 */

	VaultClient.prototype.addressExists = function(address, callback) {
	  AuthInfo.getAddress(this.domain, address, function(err, authInfo) {
	    if (err) {
	      callback(err);
	    } else {
	      callback(null, !!authInfo.addressExists);
	    }
	  });
	};

	/**
	 * Authenticate and retrieve a decrypted blob using a ripple name and password
	 *
	 * @param {string}    username
	 * @param {string}    password
	 * @param {function}  fn - Callback function
	 */

	VaultClient.prototype.login = function(username, password, device_id, callback) {
	  var self = this;
	  
	  var steps = [
	    getAuthInfo,
	    self._deriveLoginKeys,
	    getBlob
	  ];

	  async.waterfall(steps, callback);
	    
	  function getAuthInfo(callback) {
	    self.getAuthInfo(username, function(err, authInfo){
	      
	      if (authInfo && !authInfo.exists) {
	        return callback(new Error('User does not exist.'));
	      }
	            
	      return callback (err, authInfo, password);
	    });  
	  }
	  
	  function getBlob(authInfo, password, keys, callback) {
	    var options = {
	      url       : authInfo.blobvault,
	      blob_id   : keys.id,
	      key       : keys.crypt,
	      device_id : device_id
	    };
	    
	    blobClient.get(options, function(err, blob) {
	      if (err) {
	        return callback(err);
	      }

	      //save for relogin
	      self.infos[keys.id] = authInfo;

	      //migrate missing fields
	      if (blob.missing_fields) {
	        if (blob.missing_fields.encrypted_blobdecrypt_key) {     
	          console.log('migration: saving encrypted blob decrypt key');
	          authInfo.blob = blob;
	          //get the key to unlock the secret, then update the blob keys          
	          self._deriveUnlockKey(authInfo, password, keys, updateKeys);
	        }
	      }
	         
	      callback(null, {
	        blob      : blob,
	        username  : authInfo.username,
	        verified  : authInfo.emailVerified, //DEPRECIATE
	        emailVerified    : authInfo.emailVerified,
	        profileVerified  : authInfo.profile_verified,
	        identityVerified : authInfo.identity_verified
	      });
	    });
	  };
	  
	  function updateKeys (err, params, keys) {
	    if (err || !keys.unlock) {
	      return; //unable to unlock
	    }
	    
	    var secret;
	    try {
	      secret = crypt.decrypt(keys.unlock, params.blob.encrypted_secret);
	    } catch (error) {
	      return console.log('error:', 'decrypt:', error);
	    } 
	    
	    options = {
	      username  : params.username,
	      blob      : params.blob,
	      masterkey : secret,
	      keys      : keys
	    };
	    
	    blobClient.updateKeys(options, function(err, resp){
	      if (err) {
	        console.log('error:', 'updateKeys:', err);
	      }
	    });     
	  } 
	};

	/**
	 * Retreive and decrypt blob using a blob url, id and crypt derived previously.
	 *
	 * @param {string}   url - Blob vault url
	 * @param {string}   id  - Blob id from previously retreived blob
	 * @param {string}   key - Blob decryption key
	 * @param {function} fn  - Callback function
	 */

	VaultClient.prototype.relogin = function(url, id, key, device_id, callback) {
	  //use the url from previously retrieved authInfo, if necessary
	  if (!url && this.infos[id]) {
	    url = this.infos[id].blobvault;
	  }

	  if (!url) {
	    return callback(new Error('Blob vault URL is required'));
	  }

	  var options = {
	    url       : url,
	    blob_id   : id,
	    key       : key,
	    device_id : device_id
	  };
	    
	  blobClient.get(options, function(err, blob) {
	    if (err) {
	      callback(err);
	    } else {
	      callback (null, { blob: blob });
	    }
	  });
	};

	/**
	 * Decrypt the secret key using a username and password
	 *
	 * @param {string}    username
	 * @param {string}    password
	 * @param {string}    encryptSecret
	 * @param {function}  fn - Callback function
	 */

	VaultClient.prototype.unlock = function(username, password, encryptSecret, fn) {
	  var self = this;
	  
	  var steps = [
	    getAuthInfo,
	    self._deriveUnlockKey,
	    unlockSecret
	  ];

	  async.waterfall(steps, fn);
	  
	  function getAuthInfo(callback) {
	    self.getAuthInfo(username, function(err, authInfo){
	      
	      if (authInfo && !authInfo.exists) {
	        return callback(new Error('User does not exist.'));
	      }
	            
	      return callback (err, authInfo, password, {});
	    });  
	  }
	  
	  function unlockSecret (authinfo, keys, callback) {
	    var secret;
	    try {
	      secret = crypt.decrypt(keys.unlock, encryptSecret);
	    } catch (error) {
	      return callback(error);
	    }  
	    
	    callback(null, {
	      keys   : keys,
	      secret : secret
	    });      
	  }
	};

	/**
	 * Retrieve the decrypted blob and secret key in one step using
	 * the username and password
	 *
	 * @param {string}    username
	 * @param {string}    password
	 * @param {function}  fn - Callback function
	 */

	VaultClient.prototype.loginAndUnlock = function(username, password, device_id, fn) {
	  var self = this;

	  var steps = [
	    login,
	    deriveUnlockKey,
	    unlockSecret
	  ];

	  async.waterfall(steps, fn);  
	  
	  function login (callback) {
	    self.login(username, password, device_id, function(err, resp) {

	      if (err) {
	        return callback(err);
	      }
	  
	      if (!resp.blob || !resp.blob.encrypted_secret) {
	        return callback(new Error('Unable to retrieve blob and secret.'));
	      }
	  
	      if (!resp.blob.id || !resp.blob.key) {
	        return callback(new Error('Unable to retrieve keys.'));
	      }
	  
	      //get authInfo via id - would have been saved from login
	      var authInfo = self.infos[resp.blob.id];
	  
	      if (!authInfo) {
	        return callback(new Error('Unable to find authInfo'));
	      }
	    
	      callback(null, authInfo, password, resp.blob);
	    });    
	  };

	  function deriveUnlockKey (authInfo, password, blob, callback) {
	    self._deriveUnlockKey(authInfo, password, null, function(err, authInfo, keys){
	      callback(err, keys.unlock, authInfo, blob);
	    });
	  };
	  
	  function unlockSecret (unlock, authInfo, blob, callback) {
	    var secret;
	    try {
	      secret = crypt.decrypt(unlock, blob.encrypted_secret);
	    } catch (error) {
	      return callback(error);
	    }     
	    
	    callback(null, {
	      blob      : blob,
	      unlock    : unlock,
	      secret    : secret,
	      username  : authInfo.username,
	      verified  : authInfo.emailVerified, //DEPRECIATE
	      emailVerified    : authInfo.emailVerified,
	      profileVerified  : authInfo.profile_verified,
	      identityVerified : authInfo.identity_verified
	    });    
	  };  
	};

	/**
	 * Verify an email address for an existing user
	 *
	 * @param {string}    username
	 * @param {string}    token - Verification token
	 * @param {function}  fn - Callback function
	 */

	VaultClient.prototype.verify = function(username, token, callback) {
	  var self = this;

	  self.getAuthInfo(username, function (err, authInfo){
	    if (err) {
	      return callback(err);
	    }
	    
	    blobClient.verify(authInfo.blobvault, username.toLowerCase(), token, callback);     
	  });
	};

	/*
	 * changePassword
	 * @param {object} options
	 * @param {string} options.username
	 * @param {string} options.password
	 * @param {string} options.masterkey
	 * @param {object} options.blob
	 */

	VaultClient.prototype.changePassword = function (options, fn) {
	  var self     = this;
	  var password = String(options.password).trim();
	  
	  var steps = [
	    getAuthInfo,
	    self._deriveLoginKeys,
	    self._deriveUnlockKey,
	    changePassword
	  ];
	  
	  async.waterfall(steps, fn);
	    
	  function getAuthInfo(callback) {
	    self.getAuthInfo(options.username, function(err, authInfo) { 
	      return callback (err, authInfo, password);      
	    });
	  };
	  
	  function changePassword (authInfo, keys, callback) {
	    options.keys = keys;
	    blobClient.updateKeys(options, callback); 
	  };
	};

	/**
	 * rename
	 * rename a ripple account
	 * @param {object} options
	 * @param {string} options.username
	 * @param {string} options.new_username
	 * @param {string} options.password
	 * @param {string} options.masterkey
	 * @param {object} options.blob
	 * @param {function} fn
	 */

	VaultClient.prototype.rename = function (options, fn) {
	  var self         = this;
	  var new_username = String(options.new_username).trim();
	  var password     = String(options.password).trim();
	  
	  var steps = [
	    getAuthInfo,
	    self._deriveLoginKeys,
	    self._deriveUnlockKey,
	    renameBlob
	  ];

	  async.waterfall(steps, fn);
	    
	  function getAuthInfo(callback) {
	    self.getAuthInfo(new_username, function(err, authInfo){
	      
	      if (authInfo && authInfo.exists) {
	        return callback(new Error('username already taken.'));
	      } else {
	        authInfo.username = new_username;
	      }
	            
	      return callback (err, authInfo, password);
	    });  
	  };
	  
	  function renameBlob (authInfo, keys, callback) {
	    options.keys = keys;
	    blobClient.rename(options, callback);    
	  };
	};

	/**
	 * Register a new user and save to the blob vault
	 *
	 * @param {object} options
	 * @param {string} options.username
	 * @param {string} options.password
	 * @param {string} options.masterkey   //optional, will create if absent
	 * @param {string} options.email
	 * @param {string} options.activateLink
	 * @param {object} options.oldUserBlob //optional
	 * @param {function} fn
	 */

	VaultClient.prototype.register = function(options, fn) {
	  var self     = this;
	  var username = String(options.username).trim();
	  var password = String(options.password).trim();
	  var result   = self.validateUsername(username);
	  
	  if (!result.valid) {
	    return fn(new Error('invalid username.'));  
	  }
	  
	  var steps = [
	    getAuthInfo,
	    self._deriveLoginKeys,
	    self._deriveUnlockKey,
	    create
	  ];
	  
	  async.waterfall(steps, fn);
	  
	  function getAuthInfo(callback) {
	    self.getAuthInfo(username, function(err, authInfo){      
	      return callback (err, authInfo, password);
	    });  
	  };

	  function create(authInfo, keys, callback) {
	    var params = {
	      url          : authInfo.blobvault,
	      id           : keys.id,
	      crypt        : keys.crypt,
	      unlock       : keys.unlock,
	      username     : username,
	      email        : options.email,
	      masterkey    : options.masterkey || crypt.createMaster(),
	      activateLink : options.activateLink,
	      oldUserBlob  : options.oldUserBlob,
	      domain       : options.domain
	    };
	        
	    blobClient.create(params, function(err, blob) {
	      if (err) {
	        callback(err);
	      } else {
	        callback(null, {
	          blob     : blob, 
	          username : username
	        });
	      }
	    });
	  };
	};

	/**
	 * validateUsername
	 * check username for validity 
	 */

	VaultClient.prototype.validateUsername = function (username) {
	  username   = String(username).trim();
	  var result = {
	    valid  : false,
	    reason : ''
	  };
	  
	  if (username.length < 2) {
	    result.reason = 'tooshort';
	  } else if (username.length > 20) {
	    result.reason = 'toolong'; 
	  } else if (!/^[a-zA-Z0-9\-]+$/.exec(username)) {
	    result.reason = 'charset'; 
	  } else if (/^-/.exec(username)) {
	    result.reason = 'starthyphen'; 
	  } else if (/-$/.exec(username)) {
	    result.reason = 'endhyphen'; 
	  } else if (/--/.exec(username)) {
	    result.reason = 'multhyphen'; 
	  } else {
	    result.valid = true;
	  }
	  
	  return result;
	};

	/**
	 * generateDeviceID
	 * create a new random device ID for 2FA
	 */
	VaultClient.prototype.generateDeviceID = function () {
	  return crypt.createSecret(4);
	};

	/*** pass thru some blob client function ***/

	VaultClient.prototype.resendEmail   = blobClient.resendEmail;

	VaultClient.prototype.recoverBlob   = blobClient.recoverBlob;

	VaultClient.prototype.deleteBlob    = blobClient.deleteBlob;

	VaultClient.prototype.requestToken  = blobClient.requestToken;

	VaultClient.prototype.verifyToken   = blobClient.verifyToken;

	VaultClient.prototype.getAttestation = blobClient.getAttestation;

	VaultClient.prototype.updateAttestation = blobClient.updateAttestation;

	VaultClient.prototype.getAttestationSummary = blobClient.getAttestationSummary;

	//export by name
	exports.VaultClient = VaultClient;
	exports.AuthInfo    = AuthInfo;
	exports.RippleTxt   = RippleTxt;
	exports.Blob        = Blob;

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	var crypt   = __webpack_require__(6).Crypt;
	var SignedRequest = __webpack_require__(7).SignedRequest;
	var request = __webpack_require__(12);
	var extend  = __webpack_require__(9);
	var async   = __webpack_require__(8);
	var BlobClient = {};

	//Blob object class
	function BlobObj(options) {
	  if (!options) options = { };
	  
	  this.device_id = options.device_id;
	  this.url       = options.url;
	  this.id        = options.blob_id;
	  this.key       = options.key; 
	  this.identity  = new Identity(this);
	  this.data      = { };
	};

	// Blob operations
	// Do NOT change the mapping of existing ops
	BlobObj.ops = {
	  // Special
	  noop: 0,

	  // Simple ops
	  set: 16,
	  unset: 17,
	  extend: 18,

	  // Meta ops
	  push: 32,
	  pop: 33,
	  shift: 34,
	  unshift: 35,
	  filter: 36
	};


	BlobObj.opsReverseMap = [ ];
	for (var name in BlobObj.ops) {
	  BlobObj.opsReverseMap[BlobObj.ops[name]] = name;
	}

	//Identity fields
	var identityRoot   = 'identityVault';
	var identityFields = [
	  'name',
	  'entityType',
	  'email',
	  'phone',
	  'address',
	  'nationalID',
	  'birthday',
	  'birthplace'
	];

	var entityTypes = [
	  'individual',
	  'organization',
	  'corporation'
	];

	var addressFields = [
	  'contact',
	  'line1',
	  'line2',
	  'city',
	  'region',  //state/province/region
	  'postalCode',
	  'country'
	];

	var nationalIDFields = [
	  'number',
	  'type',
	  'country',
	];

	var idTypeFields = [
	  'ssn',
	  'taxID',
	  'passport',
	  'driversLicense',
	  'other'
	];

	/**
	 * Initialize a new blob object
	 *
	 * @param {function} fn - Callback function
	 */

	BlobObj.prototype.init = function(fn) {
	  var self = this, url;

	  if (self.url.indexOf('://') === -1) {
	    self.url = 'http://' + url;
	  }

	  url  = self.url + '/v1/blob/' + self.id;
	  if (this.device_id) url += '?device_id=' + this.device_id;
	  
	  request.get(url, function(err, resp) {
	    if (err) {
	      return fn(new Error(err.message || 'Could not retrieve blob'));
	    } else if (!resp.body) {
	      return fn(new Error('Could not retrieve blob'));
	    } else if (resp.body.twofactor) {
	      resp.body.twofactor.blob_id   = self.id;
	      resp.body.twofactor.blob_url  = self.url;
	      resp.body.twofactor.device_id = self.device_id;
	      resp.body.twofactor.blob_key  = self.key
	      return fn(resp.body);
	    } else if (resp.body.result !== 'success') {
	      return fn(new Error('Incorrect username or password'));
	    }
	    
	    self.revision         = resp.body.revision;
	    self.encrypted_secret = resp.body.encrypted_secret;
	    self.identity_id      = resp.body.identity_id;
	    self.id_token         = resp.body.id_token;
	    self.missing_fields   = resp.body.missing_fields;
	    //self.attestations     = resp.body.attestation_summary;
	    
	    if (!self.decrypt(resp.body.blob)) {
	      return fn(new Error('Error while decrypting blob'));
	    }

	    //Apply patches
	    if (resp.body.patches && resp.body.patches.length) {
	      var successful = true;
	      resp.body.patches.forEach(function(patch) {
	        successful = successful && self.applyEncryptedPatch(patch);
	      });

	      if (successful) {
	        self.consolidate();
	      }
	    }

	    //return with newly decrypted blob
	    fn(null, self);
	  }).timeout(8000);
	};

	/**
	 * Consolidate -
	 * Consolidate patches as a new revision
	 *
	 * @param {function} fn - Callback function
	 */

	BlobObj.prototype.consolidate = function(fn) {
	  // Callback is optional
	  if (typeof fn !== 'function') {
	    fn = function(){};
	  }

	  //console.log('client: blob: consolidation at revision', this.revision);
	  var encrypted = this.encrypt();

	  var config = {
	    method: 'POST',
	    url: this.url + '/v1/blob/consolidate',
	    dataType: 'json',
	    data: {
	      blob_id: this.id,
	      data: encrypted,
	      revision: this.revision
	    },
	  };

	  var signedRequest = new SignedRequest(config);

	  var signed = signedRequest.signHmac(this.data.auth_secret, this.id);

	  request.post(signed.url)
	    .send(signed.data)
	    .end(function(err, resp) {
	      // XXX Add better error information to exception
	      if (err) {
	        fn(new Error('Failed to consolidate blob - XHR error'));
	      } else if (resp.body && resp.body.result === 'success') {
	        fn(null, resp.body);
	      } else {
	        fn(new Error('Failed to consolidate blob'));
	      }
	  });
	};

	/**
	 * ApplyEncryptedPatch -
	 * save changes from a downloaded patch to the blob
	 *
	 * @param {string} patch - encrypted patch string
	 */

	BlobObj.prototype.applyEncryptedPatch = function(patch) {
	  try {
	    var args = JSON.parse(crypt.decrypt(this.key, patch));
	    var op   = args.shift();
	    var path = args.shift();

	    this.applyUpdate(op, path, args);
	    this.revision++;

	    return true;
	  } catch (err) {
	    //console.log('client: blob: failed to apply patch:', err.toString());
	    //console.log(err.stack);
	    return false;
	  }
	};

	/**
	 * Encrypt secret with unlock key
	 *
	 * @param {string} secretUnlockkey
	 */
	BlobObj.prototype.encryptSecret = function (secretUnlockKey, secret) {
	  return crypt.encrypt(secretUnlockKey, secret);
	};

	/**
	 * Decrypt secret with unlock key
	 *
	 * @param {string} secretUnlockkey
	 */

	BlobObj.prototype.decryptSecret = function(secretUnlockKey) {
	  return crypt.decrypt(secretUnlockKey, this.encrypted_secret);
	};

	/**
	 * Decrypt blob with crypt key
	 *
	 * @param {string} data - encrypted blob data
	 */

	BlobObj.prototype.decrypt = function(data) {
	  try {
	    this.data = JSON.parse(crypt.decrypt(this.key, data));
	    return this;
	  } catch (e) {
	    //console.log('client: blob: decryption failed', e.toString());
	    //console.log(e.stack);
	    return false;
	  }
	};

	/**
	 * Encrypt blob with crypt key
	 */

	BlobObj.prototype.encrypt = function() {
	// Filter Angular metadata before encryption
	//  if ('object' === typeof this.data &&
	//      'object' === typeof this.data.contacts)
	//    this.data.contacts = angular.fromJson(angular.toJson(this.data.contacts));

	  return crypt.encrypt(this.key, JSON.stringify(this.data));
	};

	/**
	 * Encrypt recovery key
	 *
	 * @param {string} secret
	 * @param {string} blobDecryptKey
	 */

	BlobObj.prototype.encryptBlobCrypt = function(secret, blobDecryptKey) {
	  var recoveryEncryptionKey = crypt.deriveRecoveryEncryptionKeyFromSecret(secret);
	  return crypt.encrypt(recoveryEncryptionKey, blobDecryptKey);
	};

	/**
	 * Decrypt recovery key
	 *
	 * @param {string} secret
	 * @param {string} encryptedKey
	 */

	function decryptBlobCrypt (secret, encryptedKey) {
	  var recoveryEncryptionKey = crypt.deriveRecoveryEncryptionKeyFromSecret(secret);
	  return crypt.decrypt(recoveryEncryptionKey, encryptedKey);
	};

	/**** Blob updating functions ****/

	/**
	 * Set blob element
	 */

	BlobObj.prototype.set = function(pointer, value, fn) {
	  if (pointer == "/" + identityRoot && this.data[identityRoot]) {
	    return fn(new Error('Cannot overwrite Identity Vault')); 
	  }
	    
	  this.applyUpdate('set', pointer, [value]);
	  this.postUpdate('set', pointer, [value], fn);
	};

	/**
	 * Remove blob element
	 */

	BlobObj.prototype.unset = function(pointer, fn) {
	  if (pointer == "/" + identityRoot) {
	    return fn(new Error('Cannot remove Identity Vault')); 
	  }
	  
	  this.applyUpdate('unset', pointer, []);
	  this.postUpdate('unset', pointer, [], fn);
	};

	/**
	 * Extend blob object
	 */

	BlobObj.prototype.extend = function(pointer, value, fn) {
	  this.applyUpdate('extend', pointer, [value]);
	  this.postUpdate('extend', pointer, [value], fn);
	};

	/**
	 * Prepend blob array
	 */

	BlobObj.prototype.unshift = function(pointer, value, fn) {    
	  this.applyUpdate('unshift', pointer, [value]);
	  this.postUpdate('unshift', pointer, [value], fn);
	};

	/**
	 * Filter the row(s) from an array.
	 *
	 * This method will find any entries from the array stored under `pointer` and
	 * apply the `subcommands` to each of them.
	 *
	 * The subcommands can be any commands with the pointer parameter left out.
	 */

	BlobObj.prototype.filter = function(pointer, field, value, subcommands, callback) {
	  var args = Array.prototype.slice.apply(arguments);

	  if (typeof args[args.length - 1] === 'function') {
	    callback = args.pop();
	  }

	  args.shift();

	  // Normalize subcommands to minimize the patch size
	  args = args.slice(0, 2).concat(normalizeSubcommands(args.slice(2), true));

	  this.applyUpdate('filter', pointer, args);
	  this.postUpdate('filter', pointer, args, callback);
	};

	/**
	 * Apply udpdate to the blob
	 */

	BlobObj.prototype.applyUpdate = function(op, path, params) {
	  // Exchange from numeric op code to string
	  if (typeof op === 'number') {
	    op = BlobObj.opsReverseMap[op];
	  }

	  if (typeof op !== 'string') {
	    throw new Error('Blob update op code must be a number or a valid op id string');
	  }

	  // Separate each step in the 'pointer'
	  var pointer = path.split('/');
	  var first = pointer.shift();

	  if (first !== '') {
	    throw new Error('Invalid JSON pointer: '+path);
	  }

	  this._traverse(this.data, pointer, path, op, params);
	};

	//for applyUpdate function
	BlobObj.prototype._traverse = function(context, pointer, originalPointer, op, params) {
	  var _this = this;
	  var part = _this.unescapeToken(pointer.shift());

	  if (Array.isArray(context)) {
	    if (part === '-') {
	      part = context.length;
	    } else if (part % 1 !== 0 && part >= 0) {
	      throw new Error('Invalid pointer, array element segments must be a positive integer, zero or '-'');
	    }
	  } else if (typeof context !== 'object') {
	    return null;
	  } else if (!context.hasOwnProperty(part)) {
	    // Some opcodes create the path as they're going along
	    if (op === 'set') {
	      context[part] = {};
	    } else if (op === 'unshift') {
	      context[part] = [];
	    } else {
	      return null;
	    }
	  }

	  if (pointer.length !== 0) {
	    return this._traverse(context[part], pointer, originalPointer, op, params);
	  }

	  switch (op) {
	    case 'set':
	      context[part] = params[0];
	      break;
	    case 'unset':
	      if (Array.isArray(context)) {
	        context.splice(part, 1);
	      } else {
	        delete context[part];
	      }
	      break;
	    case 'extend':
	      if (typeof context[part] !== 'object') {
	        throw new Error('Tried to extend a non-object');
	      }
	      extend(true, context[part], params[0]);
	      break;
	    case 'unshift':
	      if (typeof context[part] === 'undefined') {
	        context[part] = [ ];
	      } else if (!Array.isArray(context[part])) {
	        throw new Error('Operator "unshift" must be applied to an array.');
	      }
	      context[part].unshift(params[0]);
	      break;
	    case 'filter':
	      if (Array.isArray(context[part])) {
	        context[part].forEach(function(element, i) {
	          if (typeof element === 'object' && element.hasOwnProperty(params[0]) && element[params[0]] === params[1]) {
	            var subpointer = originalPointer + '/' + i;
	            var subcommands = normalizeSubcommands(params.slice(2));

	            subcommands.forEach(function(subcommand) {
	              var op = subcommand[0];
	              var pointer = subpointer + subcommand[1];
	              _this.applyUpdate(op, pointer, subcommand.slice(2));
	            });
	          }
	        });
	      }
	      break;
	    default:
	      throw new Error('Unsupported op '+op);
	  }
	};

	BlobObj.prototype.escapeToken = function(token) {
	  return token.replace(/[~\/]/g, function(key) {
	    return key === '~' ? '~0' : '~1';
	  });
	};

	BlobObj.prototype.unescapeToken = function(str) {
	  return str.replace(/~./g, function(m) {
	    switch (m) {
	      case '~0':
	        return '~';
	      case '~1':
	        return '/';
	    }
	    throw new Error('Invalid tilde escape: ' + m);
	  });
	};

	/**
	 * Sumbit update to blob vault
	 */

	BlobObj.prototype.postUpdate = function(op, pointer, params, fn) {
	  // Callback is optional
	  if (typeof fn !== 'function') {
	    fn = function(){};
	  }

	  if (typeof op === 'string') {
	    op = BlobObj.ops[op];
	  }

	  if (typeof op !== 'number') {
	    throw new Error('Blob update op code must be a number or a valid op id string');
	  }

	  if (op < 0 || op > 255) {
	    throw new Error('Blob update op code out of bounds');
	  }

	  //console.log('client: blob: submitting update', BlobObj.opsReverseMap[op], pointer, params);

	  params.unshift(pointer);
	  params.unshift(op);

	  var config = {
	    method: 'POST',
	    url: this.url + '/v1/blob/patch',
	    dataType: 'json',
	    data: {
	      blob_id: this.id,
	      patch: crypt.encrypt(this.key, JSON.stringify(params))
	    }
	  };


	  var signedRequest = new SignedRequest(config);
	  var signed = signedRequest.signHmac(this.data.auth_secret, this.id);

	  request.post(signed.url)
	  .send(signed.data)
	  .end(function(err, resp) {
	    if (err) {
	      fn(new Error('Patch could not be saved - XHR error'));
	    } else if (!resp.body || resp.body.result !== 'success') {
	      fn(new Error('Patch could not be saved - bad result')); 
	    } else {
	      fn(null, resp.body);
	    }
	  });
	};

	/**
	 * get2FA - HMAC signed request
	 */

	BlobObj.prototype.get2FA = function (fn) {
	  var config = {
	    method : 'GET',
	    url    : this.url + '/v1/blob/' + this.id + '/2FA?device_id=' + this.device_id,
	  };
	  
	  var signedRequest = new SignedRequest(config);
	  var signed = signedRequest.signHmac(this.data.auth_secret, this.id);  

	  request.get(signed.url)
	    .end(function(err, resp) { 
	      if (err) {
	        fn(err);
	      } else if (resp.body && resp.body.result === 'success') {
	        fn(null, resp.body);
	      } else if (resp.body && resp.body.result === 'error') {
	        fn(new Error(resp.body.message)); 
	      } else {
	        fn(new Error('Unable to retrieve settings.'));
	      }
	    });   
	}

	/**
	 * set2FA
	 * modify 2 factor auth settings
	 * @params {object}  options
	 * @params {string}  options.masterkey
	 * @params {boolean} options.enabled
	 * @params {string}  options.phone
	 * @params {string}  options.country_code
	 */

	BlobObj.prototype.set2FA = function(options, fn) {
	  
	  var config = {
	    method : 'POST',
	    url    : this.url + '/v1/blob/' + this.id + '/2FA',
	    data   : {
	      enabled      : options.enabled,
	      phone        : options.phone,
	      country_code : options.country_code
	    }
	  };

	  var signedRequest = new SignedRequest(config);
	  var signed = signedRequest.signAsymmetric(options.masterkey, this.data.account_id, this.id);

	  request.post(signed.url)
	    .send(signed.data)
	    .end(function(err, resp) { 
	      if (err) {
	        fn(err);
	      } else if (resp.body && resp.body.result === 'success') {
	        fn(null, resp.body);
	      } else if (resp.body && resp.body.result === 'error') {
	        fn(resp.body); 
	      } else {
	        fn(new Error('Unable to update settings.'));
	      }
	    }); 
	};

	/***** helper functions *****/

	function normalizeSubcommands(subcommands, compress) {
	  // Normalize parameter structure
	  if (/(number|string)/.test(typeof subcommands[0])) {
	    // Case 1: Single subcommand inline
	    subcommands = [subcommands];
	  } else if (subcommands.length === 1 && Array.isArray(subcommands[0]) && /(number|string)/.test(typeof subcommands[0][0])) {
	    // Case 2: Single subcommand as array
	    // (nothing to do)
	  } else if (Array.isArray(subcommands[0])) {
	    // Case 3: Multiple subcommands as array of arrays
	    subcommands = subcommands[0];
	  }

	  // Normalize op name and convert strings to numeric codes
	  subcommands = subcommands.map(function(subcommand) {
	    if (typeof subcommand[0] === 'string') {
	      subcommand[0] = BlobObj.ops[subcommand[0]];
	    }

	    if (typeof subcommand[0] !== 'number') {
	      throw new Error('Invalid op in subcommand');
	    }

	    if (typeof subcommand[1] !== 'string') {
	      throw new Error('Invalid path in subcommand');
	    }

	    return subcommand;
	  });

	  if (compress) {
	    // Convert to the minimal possible format
	    if (subcommands.length === 1) {
	      return subcommands[0];
	    } else {
	      return [subcommands];
	    }
	  } else {
	    return subcommands;
	  }
	}


	/***** identity ****/

	/** 
	 * Identity class
	 * 
	 */

	var Identity = function (blob) {
	  this._getBlob = function() {
	    return blob;
	  };
	}; 

	/**
	 * getFullAddress
	 * returns the address formed into a text string
	 * @param {string} key - Encryption key
	 */

	Identity.prototype.getFullAddress = function (key) {
	  var blob = this._getBlob();
	  if (!blob || 
	      !blob.data || 
	      !blob.data[identityRoot] ||
	      !blob.data[identityRoot].address) {
	    return "";
	  }     
	  
	  var address = this.get('address', key);
	  var text    = "";
	  
	  if (address.value.contact)    text += address.value.contact;
	  if (address.value.line1)      text += " " + address.value.line1;
	  if (address.value.line2)      text += " " + address.value.line2;
	  if (address.value.city)       text += " " + address.value.city;
	  if (address.value.region)     text += " " + address.value.region;
	  if (address.value.postalCode) text += " " + address.value.postalCode;
	  if (address.value.country)    text += " " + address.value.country;
	  return text;
	};

	/**
	 * getAll
	 * get and decrypt all identity fields
	 * @param {string} key  - Encryption key
	 * @param {function} fn - Callback function
	 */

	Identity.prototype.getAll = function (key) {
	  var blob = this._getBlob();
	  if (!blob || !blob.data || !blob.data[identityRoot]) {
	    return {};
	  }   
	  
	  var result = {}, identity = blob.data[identityRoot];
	  for (var i in identity) {
	    result[i] = this.get(i, key);
	  }
	  
	  return result;
	};

	/**
	 * get
	 * get and decrypt a single identity field
	 * @param {string} pointer - Field to retrieve
	 * @param {string} key     - Encryption key
	 */

	Identity.prototype.get = function (pointer, key) {
	  var blob = this._getBlob();
	  if (!blob || !blob.data || !blob.data[identityRoot]) {
	    return null;
	  }
	  
	  var data = blob.data[identityRoot][pointer];
	  if (data && data.encrypted) {
	    return decrypt(key, data);
	    
	  } else if (data) {
	    return data;
	    
	  } else {
	    return null;
	  }
	  
	  function decrypt (key, data) {
	    var value;
	    var result = {encrypted : true};
	    
	    try {
	      value = crypt.decrypt(key, data.value);
	    } catch (e) {
	      result.value  = data.value;
	      result.error  = e; 
	      return result;
	    }
	    
	    try {
	      result.value = JSON.parse(value);
	    } catch (e) {
	      result.value = value;
	    }
	    
	    return result;
	  }
	};

	/**
	 * set
	 * set and encrypt a single identity field.
	 * @param {string} pointer - Field to set
	 * @param {string} key     - Encryption key
	 * @param {string} value   - Unencrypted data
	 * @param {function} fn    - Callback function
	 */

	Identity.prototype.set = function (pointer, key, value, fn) {
	  var self = this, blob = this._getBlob();
	  
	  if (!fn) fn = function(){ };
	  
	  //check fields for validity
	  if (identityFields.indexOf(pointer) === -1) {
	    return fn(new Error("invalid identity field"));   
	  
	  //validate address fields  
	  } else if (pointer === 'address') {
	    if (typeof value !== 'object') {
	      return fn(new Error("address must be an object"));   
	    }
	    
	    for (var addressField in value) {
	      if (addressFields.indexOf(addressField) === -1) {
	        return fn(new Error("invalid address field"));   
	      }
	    }
	  
	  //validate nationalID fields  
	  } else if (pointer === 'nationalID') {
	    if (typeof value !== 'object') {
	      return fn(new Error("nationalID must be an object"));   
	    }
	    
	    for (var idField in value) {
	      if (nationalIDFields.indexOf(idField) === -1) {
	        return fn(new Error("invalid nationalID field"));   
	      }
	      
	      if (idField === 'type') {
	        if (idTypeFields.indexOf(value[idField]) === -1) {
	          return fn(new Error("invalid nationalID type"));   
	        }      
	      }
	    }   
	    
	  //validate entity type   
	  } else if (pointer === 'entityType') {
	    if (entityTypes.indexOf(value) === -1) {
	      return fn(new Error("invalid entity type"));   
	    }     
	  }

	  async.waterfall([ validate, set ], fn);
	    
	  //make sure the identity setup is valid
	  function validate (callback) {
	   
	    if (!blob) return fn(new Error("Identity must be associated with a blob"));
	    else if (!blob.data) return fn(new Error("Invalid Blob"));  
	    else if (!blob.data[identityRoot]) {
	      blob.set("/" + identityRoot, {}, function(err, res){
	        if (err) return callback (err);
	        else     return callback (null);
	      }); 
	    } else return callback (null);
	  };
	    
	  function set (callback) {

	    //NOTE: currently we will overwrite if it already exists
	    //the other option would be to require decrypting with the
	    //existing key as a form of authorization
	    //var current = self.get(pointer, key);  
	    //if (current && current.error) {
	    //  return fn ? fn(current.error) : undefined;
	    //}
	    
	    var data = {};
	    data[pointer] = {
	      encrypted : key ? true : false,
	      value     : key ? encrypt(key, value) : value  
	    };
	    
	    self._getBlob().extend("/" + identityRoot, data, callback);
	  };
	  
	  function encrypt (key, value) {
	    if (typeof value === 'object') value = JSON.stringify(value);
	    return crypt.encrypt(key, value);
	  }
	};

	/**
	 * unset
	 * remove a single identity field - will only be removed
	 * with a valid decryption key
	 * @param {string} pointer - Field to remove
	 * @param {string} key     - Encryption key
	 * @param {function} fn    - Callback function
	 */

	Identity.prototype.unset = function (pointer, key, fn) {
	  
	  if (!fn) fn = function(){ };
	  
	  //NOTE: this is rather useless since you can overwrite
	  //without an encryption key
	  var data = this.get(pointer, key);
	  if (data && data.error) {
	    return fn(data.error);
	  }
	  
	  this._getBlob().unset("/" + identityRoot+"/" + pointer, fn);
	};

	/***** blob client methods ****/

	/**
	 * Blob object class
	 */ 
	 
	exports.Blob = BlobObj;

	/**
	 * Get ripple name for a given address
	 */

	BlobClient.getRippleName = function(url, address, fn) {
	  if (!crypt.isValidAddress(address)) {
	    return fn (new Error('Invalid ripple address'));
	  }

	  if (!crypt.isValidAddress(address)) return fn (new Error("Invalid ripple address"));
	  request.get(url + '/v1/user/' + address, function(err, resp){
	    if (err) {
	      fn(new Error('Unable to access vault sever'));
	    } else if (resp.body && resp.body.username) {
	      fn(null, resp.body.username);
	    } else if (resp.body && resp.body.exists === false) {
	      fn (new Error('No ripple name for this address'));
	    } else {
	      fn(new Error('Unable to determine if ripple name exists'));
	    }
	  });
	};

	/**
	 * Retrive a blob with url, id and key
	 * @params {object} options
	 * @params {string} options.url
	 * @params {string} options.blob_id
	 * @params {string} options.key
	 * @params {string} options.device_id //optional
	 */

	BlobClient.get = function (options, fn) {
	  var blob = new BlobObj(options);
	  blob.init(fn);
	};

	/**
	 * requestToken
	 * request new token to be sent for 2FA
	 * @param {string} url
	 * @param {string} id
	 * @param {string} force_sms
	 */

	BlobClient.requestToken = function (url, id, force_sms, fn) {
	  var config = {
	    method : 'GET',
	    url    : url + '/v1/blob/' + id + '/2FA/requestToken'
	  };
	  
	  
	  if (force_sms && force_sms instanceof Function) {
	    fn = force_sms;
	  } else if (force_sms) {
	    config.url += "?force_sms=true";
	  }
	  
	  request.get(config.url)
	    .end(function(err, resp) { 
	      if (err) {
	        fn(err);
	      } else if (resp.body && resp.body.result === 'success') {
	        fn(null, resp.body);
	      } else if (resp.body && resp.body.result === 'error') {
	        fn(new Error(resp.body.message)); 
	      } else {
	        fn(new Error('Unable to request authentication token.'));
	      }
	    }); 
	}; 

	/**
	 * verifyToken
	 * verify a device token for 2FA  
	 * @param {object} options
	 * @param {string} options.url
	 * @param {string} options.id 
	 * @param {string} options.device_id 
	 * @param {string} options.token
	 * @param {boolean} options.remember_me
	 */

	BlobClient.verifyToken = function (options, fn) {
	  var config = {
	    method : 'POST',
	    url    : options.url + '/v1/blob/' + options.id + '/2FA/verifyToken',
	    data   : {
	      device_id   : options.device_id,
	      token       : options.token,
	      remember_me : options.remember_me
	    }
	  };
	  
	  request.post(config.url)
	    .send(config.data)
	    .end(function(err, resp) { 
	      if (err) {
	        fn(err);
	      } else if (resp.body && resp.body.result === 'success') {
	        fn(null, resp.body);
	      } else if (resp.body && resp.body.result === 'error') {
	        fn(new Error(resp.body.message)); 
	      } else {
	        fn(new Error('Unable to verify authentication token.'));
	      }
	    });   
	};

	/**
	 * Verify email address
	 */

	BlobClient.verify = function(url, username, token, fn) {
	  url += '/v1/user/' + username + '/verify/' + token;
	  request.get(url, function(err, resp) {
	    if (err) {    
	      fn(new Error("Failed to verify the account - XHR error"));
	    } else if (resp.body && resp.body.result === 'success') {
	      fn(null, resp.body);
	    } else {
	      fn(new Error('Failed to verify the account'));
	    }
	  });
	};

	/**
	 * resendEmail
	 * send a new verification email
	 * @param {object}   opts
	 * @param {string}   opts.id
	 * @param {string}   opts.username
	 * @param {string}   opts.account_id
	 * @param {string}   opts.email
	 * @param {string}   opts.activateLink
	 * @param {function} fn - Callback
	 */

	BlobClient.resendEmail = function (opts, fn) {
	  var config = {
	    method : 'POST',
	    url    : opts.url + '/v1/user/email',
	    data   : {
	      blob_id  : opts.id,
	      username : opts.username,
	      email    : opts.email,
	      hostlink : opts.activateLink
	    }
	  };

	  var signedRequest = new SignedRequest(config);
	  var signed = signedRequest.signAsymmetric(opts.masterkey, opts.account_id, opts.id);

	  request.post(signed.url)
	    .send(signed.data)
	    .end(function(err, resp) {
	      if (err) {
	        console.log('error:', "resendEmail:", err);
	        fn(new Error("Failed to resend the token"));
	      } else if (resp.body && resp.body.result === 'success') {
	        fn(null, resp.body);
	      } else if (resp.body && resp.body.result === 'error') {
	        console.log('error:', "resendEmail:", resp.body.message);
	        fn(new Error("Failed to resend the token"));
	      } else {
	        fn(new Error("Failed to resend the token")); 
	      }
	    });
	};

	/**
	 * RecoverBlob
	 * recover a blob using the account secret
	 * @param {object} opts
	 * @param {string} opts.url
	 * @param {string} opts.username
	 * @param {string} opts.masterkey
	 * @param {function} fn
	 */

	BlobClient.recoverBlob = function (opts, fn) {
	  var username = String(opts.username).trim();
	  var config   = {
	    method : 'GET',
	    url    : opts.url + '/v1/user/recov/' + username,
	  };

	  var signedRequest = new SignedRequest(config);
	  var signed = signedRequest.signAsymmetricRecovery(opts.masterkey, username);  

	  request.get(signed.url)
	    .end(function(err, resp) {
	      if (err) {
	        fn(err);
	      } else if (resp.body && resp.body.result === 'success') {
	        if (!resp.body.encrypted_blobdecrypt_key) {
	          fn(new Error('Missing encrypted blob decrypt key.'));      
	        } else {
	          handleRecovery(resp);  
	        }       
	      } else if (resp.body && resp.body.result === 'error') {
	        fn(new Error(resp.body.message)); 
	      } else {
	        fn(new Error('Could not recover blob'));
	      }
	    });
	    
	  function handleRecovery (resp) {

	    var params = {
	      url     : opts.url,
	      blob_id : resp.body.blob_id,
	      key     : decryptBlobCrypt(opts.masterkey, resp.body.encrypted_blobdecrypt_key)
	    }
	    
	    var blob  = new BlobObj(params);
	    
	    blob.revision = resp.body.revision;
	    blob.encrypted_secret = resp.body.encrypted_secret;

	    if (!blob.decrypt(resp.body.blob)) {
	      return fn(new Error('Error while decrypting blob'));
	    }

	    //Apply patches
	    if (resp.body.patches && resp.body.patches.length) {
	      var successful = true;
	      resp.body.patches.forEach(function(patch) {
	        successful = successful && blob.applyEncryptedPatch(patch);
	      });

	      if (successful) {
	        blob.consolidate();
	      }
	    }

	    //return with newly decrypted blob
	    fn(null, blob);
	  };
	};


	/**
	 * updateKeys
	 * Change the blob encryption keys
	 * @param {object} opts
	 * @param {string} opts.username
	 * @param {object} opts.keys
	 * @param {object} opts.blob
	 * @param {string} masterkey
	 */

	BlobClient.updateKeys = function (opts, fn) {
	  var old_id    = opts.blob.id;
	  opts.blob.id  = opts.keys.id;
	  opts.blob.key = opts.keys.crypt;
	  opts.blob.encrypted_secret = opts.blob.encryptSecret(opts.keys.unlock, opts.masterkey);
	  
	  var config = {
	    method : 'POST',
	    url    : opts.blob.url + '/v1/user/' + opts.username + '/updatekeys',
	    data   : {
	      blob_id  : opts.blob.id,
	      data     : opts.blob.encrypt(),
	      revision : opts.blob.revision,
	      encrypted_secret : opts.blob.encrypted_secret,
	      encrypted_blobdecrypt_key : opts.blob.encryptBlobCrypt(opts.masterkey, opts.keys.crypt),
	    }
	  };

	  var signedRequest = new SignedRequest(config);
	  var signed = signedRequest.signAsymmetric(opts.masterkey, opts.blob.data.account_id, old_id); 

	  request.post(signed.url)
	    .send(signed.data)
	    .end(function(err, resp) {
	      if (err) {
	        console.log('error:', 'updateKeys:', err);
	        fn(new Error('Failed to update blob - XHR error'));
	      } else if (!resp.body || resp.body.result !== 'success') {
	        console.log('error:', 'updateKeys:', resp.body ? resp.body.message : null);
	        fn(new Error('Failed to update blob - bad result')); 
	      } else {
	        fn(null, resp.body);
	      }
	    });     
	}; 
	 
	/**
	 * rename
	 * Change the username
	 * @param {object} opts
	 * @param {string} opts.username
	 * @param {string} opts.new_username
	 * @param {object} opts.keys
	 * @param {object} opts.blob
	 * @param {string} masterkey
	 */

	BlobClient.rename = function (opts, fn) {
	  var old_id    = opts.blob.id;
	  opts.blob.id  = opts.keys.id;
	  opts.blob.key = opts.keys.crypt;
	  opts.blob.encryptedSecret = opts.blob.encryptSecret(opts.keys.unlock, opts.masterkey);

	  var config = {
	    method: 'POST',
	    url: opts.blob.url + '/v1/user/' + opts.username + '/rename',
	    data: {
	      blob_id  : opts.blob.id,
	      username : opts.new_username,
	      data     : opts.blob.encrypt(),
	      revision : opts.blob.revision,
	      encrypted_secret : opts.blob.encryptedSecret,
	      encrypted_blobdecrypt_key : opts.blob.encryptBlobCrypt(opts.masterkey, opts.keys.crypt)
	    }
	  };

	  var signedRequest = new SignedRequest(config);
	  var signed = signedRequest.signAsymmetric(opts.masterkey, opts.blob.data.account_id, old_id);

	  request.post(signed.url)
	    .send(signed.data)
	    .end(function(err, resp) {
	      if (err) {
	        console.log('error:', 'rename:', err);
	        fn(new Error('Failed to rename'));
	      } else if (resp.body && resp.body.result === 'success') {
	        fn(null, resp.body);
	      } else if (resp.body && resp.body.result === 'error') {
	        console.log('error:', 'rename:', resp.body.message);
	        fn(new Error('Failed to rename'));
	      } else {
	        fn(new Error('Failed to rename'));
	      }
	    });
	};

	/**
	 * Create a blob object
	 *
	 * @param {object} options
	 * @param {string} options.url
	 * @param {string} options.id
	 * @param {string} options.crypt
	 * @param {string} options.unlock
	 * @param {string} options.username
	 * @param {string} options.masterkey
	 * @param {object} options.oldUserBlob
	 * @param {object} options.domain
	 * @param {function} fn
	 */

	BlobClient.create = function(options, fn) {
	  var params = {
	    url     : options.url,
	    blob_id : options.id,
	    key     : options.crypt
	  }
	  var blob = new BlobObj(params);

	  blob.revision = 0;

	  blob.data = {
	    auth_secret : crypt.createSecret(8),
	    account_id  : crypt.getAddress(options.masterkey),
	    email       : options.email,
	    contacts    : [],
	    created     : (new Date()).toJSON()
	  };

	  blob.encrypted_secret = blob.encryptSecret(options.unlock, options.masterkey);

	  // Migration
	  if (options.oldUserBlob) {
	    blob.data.contacts = options.oldUserBlob.data.contacts;
	  }

	  //post to the blob vault to create
	  var config = {
	    method : 'POST',
	    url    : options.url + '/v1/user',
	    data   : {
	      blob_id     : options.id,
	      username    : options.username,
	      address     : blob.data.account_id,
	      auth_secret : blob.data.auth_secret,
	      data        : blob.encrypt(),
	      email       : options.email,
	      hostlink    : options.activateLink,
	      domain      : options.domain,
	      encrypted_blobdecrypt_key : blob.encryptBlobCrypt(options.masterkey, options.crypt),
	      encrypted_secret : blob.encrypted_secret
	    }
	  };

	  var signedRequest = new SignedRequest(config);
	  var signed = signedRequest.signAsymmetric(options.masterkey, blob.data.account_id, options.id);
	  
	  request.post(signed.url)
	    .send(signed.data)
	    .end(function(err, resp) {
	      if (err) {
	        fn(err);
	      } else if (resp.body && resp.body.result === 'success') {
	        blob.identity_id = resp.body.identity_id;
	        fn(null, blob, resp.body);
	      } else if (resp.body && resp.body.result === 'error') {
	        var err = new Error(resp.body.message);
	        if (resp.body.missing) err.missing = resp.body.missing;
	        fn (err);
	      } else {
	        fn(new Error('Could not create blob'));
	      }
	    });
	};

	/**
	 * deleteBlob
	 * @param {object} options
	 * @param {string} options.url
	 * @param {string} options.username
	 * @param {string} options.blob_id
	 * @param {string} options.account_id
	 * @param {string} options.masterkey 
	 */

	BlobClient.deleteBlob = function(options, fn) {
	  
	  var config = {
	    method : 'DELETE',
	    url    : options.url + '/v1/user/' + options.username,
	  };

	  var signedRequest = new SignedRequest(config);
	  var signed = signedRequest.signAsymmetric(options.masterkey, options.account_id, options.blob_id);
	  request.del(signed.url)
	    .end(function(err, resp) {
	      if (err) {
	        fn(err);
	      } else if (resp.body && resp.body.result === 'success') {
	        fn(null, resp.body);
	      } else if (resp.body && resp.body.result === 'error') {
	        fn(new Error(resp.body.message)); 
	      } else if (resp.error && resp.error.status === 404) {
	        fn(new Error('Blob not found'));         
	      } else {
	        if (resp.error) console.log(resp.error.toString());
	        fn(new Error('Could not delete blob'));
	      }
	    });  
	};

	/*** identity related functions ***/

	/**
	 * updateProfile
	 * update information stored outside the blob - HMAC signed
	 * @param {object}
	 * @param {string} opts.url
	 * @param {string} opts.auth_secret
	 * @param {srring} opts.blob_id
	 * @param {object} opts.profile 
	 * @param {array}  opts.profile.attributes (optional, array of attribute objects)
	 * @param {array}  opts.profile.addresses (optional, array of address objects)
	 * 
	 * @param {string} attribute.id ... id of existing attribute
	 * @param {string} attribute.name ... attribute name i.e. ripple_address
	 * @param {string} attribute.type ... optional, sub-type of attribute
	 * @param {string} attribute.value ... value of attribute
	 * @param {string} attribute.domain ... corresponding domain
	 * @param {string} attribute.status ... “current”, “removed”, etc.
	 * @param {string} attribute.visibitlity ... “public”, ”private”
	 */

	BlobClient.updateProfile = function (opts, fn) {
	  var config = {
	    method: 'POST',
	    url: opts.url + '/v1/profile/',
	    dataType: 'json',
	    data: opts.profile
	  };

	  var signedRequest = new SignedRequest(config);
	  var signed = signedRequest.signHmac(opts.auth_secret, opts.blob_id);  
	  
	  request.post(signed.url)
	    .send(signed.data)
	    .end(function(err, resp) {
	      
	      if (err) {
	        console.log('error:', 'updateProfile:', err);
	        fn(new Error('Failed to update profile - XHR error'));
	      } else if (resp.body && resp.body.result === 'success') {
	        fn(null, resp.body);
	      } else if (resp.body) {
	        console.log('error:', 'updateProfile:', resp.body);
	        fn(new Error('Failed to update profile'));
	      } else {
	        fn(new Error('Failed to update profile'));
	      } 
	    });
	};

	/**
	 * getProfile
	 * @param {Object} opts
	 * @param {string} opts.url
	 * @param {string} opts.auth_secret
	 * @param {srring} opts.blob_id
	 */

	BlobClient.getProfile = function (opts, fn) {
	  var config = {
	    method: 'GET',
	    url: opts.url + '/v1/profile/'
	  };

	  var signedRequest = new SignedRequest(config);
	  var signed = signedRequest.signHmac(opts.auth_secret, opts.blob_id);  
	  
	  request.get(signed.url)
	    .send(signed.data)
	    .end(function(err, resp) {
	      
	      if (err) {
	        console.log('error:', 'getProfile:', err);
	        fn(new Error('Failed to get profile - XHR error'));
	      } else if (resp.body && resp.body.result === 'success') {
	        fn(null, resp.body);
	      } else if (resp.body) {
	        console.log('error:', 'getProfile:', resp.body);
	        fn(new Error('Failed to get profile'));
	      } else {
	        fn(new Error('Failed to get profile'));
	      } 
	    });
	};

	/**
	 * getAttestation
	 * @param {Object} opts
	 * @param {string} opts.url
	 * @param {string} opts.auth_secret
	 * @param {string} opts.blob_id
	 * @param {string} opts.type (email,phone,basic_identity)
	 * @param {object} opts.phone (required for type 'phone')
	 * @param {string} opts.email (required for type 'email')
	 */

	BlobClient.getAttestation = function (opts, fn) {
	  var params = { };
	  
	  if (opts.phone) params.phone = opts.phone;
	  if (opts.email) params.email = opts.email;
	      
	  var config = {
	    method: 'POST',
	    url: opts.url + '/v1/attestation/' + opts.type,
	    dataType: 'json',
	    data: params
	  };
	  
	  var signedRequest = new SignedRequest(config);
	  var signed = signedRequest.signHmac(opts.auth_secret, opts.blob_id);  
	  
	  request.post(signed.url)
	    .send(signed.data)
	    .end(function(err, resp) {
	      
	      if (err) {
	        console.log('error:', 'attest:', err);
	        fn(new Error('attestation error - XHR error'));
	      } else if (resp.body && resp.body.result === 'success') {
	        if (resp.body.attestation) {
	          resp.body.decoded = BlobClient.parseAttestation(resp.body.attestation);
	        }
	        
	        fn(null, resp.body);
	      } else if (resp.body) {
	        console.log('error:', 'attestation:', resp.body);
	        fn(new Error('attestation error: ' + resp.body.message || ""));
	      } else {
	        fn(new Error('attestation error'));
	      } 
	    });
	};  

	/**
	 * getAttestationSummary
	 * @param {Object} opts
	 * @param {string} opts.url
	 * @param {string} opts.auth_secret
	 * @param {string} opts.blob_id
	 */

	BlobClient.getAttestationSummary = function (opts, fn) {


	  var config = {
	    method: 'GET',
	    url: opts.url + '/v1/attestation/summary',
	    dataType: 'json'
	  };
	  
	  if (opts.full) config.url += '?full=true';
	  
	  var signedRequest = new SignedRequest(config);
	  var signed = signedRequest.signHmac(opts.auth_secret, opts.blob_id);  
	  
	  request.get(signed.url)
	    .send(signed.data)
	    .end(function(err, resp) {
	      
	      if (err) {
	        console.log('error:', 'attest:', err);
	        fn(new Error('attestation error - XHR error'));
	      } else if (resp.body && resp.body.result === 'success') {
	        if (resp.body.attestation) {
	          resp.body.decoded = BlobClient.parseAttestation(resp.body.attestation);
	        }
	        
	        fn(null, resp.body);
	      } else if (resp.body) {
	        console.log('error:', 'attestation:', resp.body);
	        fn(new Error('attestation error: ' + resp.body.message || ""));
	      } else {
	        fn(new Error('attestation error'));
	      } 
	    });
	};  

	/**
	 * updateAttestation
	 * @param {Object} opts
	 * @param {string} opts.url
	 * @param {string} opts.auth_secret
	 * @param {string} opts.blob_id
	 * @param {string} opts.type (email,phone,profile,identity)
	 * @param {object} opts.phone (required for type 'phone')
	 * @param {object} opts.profile (required for type 'profile')
	 * @param {string} opts.email (required for type 'email')
	 * @param {string} opts.answers (required for type 'identity')
	 * @param {string} opts.token (required for completing email or phone attestations)
	 */

	BlobClient.updateAttestation = function (opts, fn) {

	  var params = { };
	  
	  if (opts.phone)    params.phone   = opts.phone;
	  if (opts.profile)  params.profile = opts.profile;
	  if (opts.email)    params.email   = opts.email;
	  if (opts.token)    params.token   = opts.token;
	  if (opts.answers)  params.answers = opts.answers;
	      
	  var config = {
	    method: 'POST',
	    url: opts.url + '/v1/attestation/' + opts.type + '/update',
	    dataType: 'json',
	    data: params
	  };

	  var signedRequest = new SignedRequest(config);
	  var signed = signedRequest.signHmac(opts.auth_secret, opts.blob_id);  
	  
	  request.post(signed.url)
	    .send(signed.data)
	    .end(function(err, resp) {
	      
	      if (err) {
	        console.log('error:', 'attest:', err);
	        fn(new Error('attestation error - XHR error'));
	      } else if (resp.body && resp.body.result === 'success') {
	        if (resp.body.attestation) {
	          resp.body.decoded = BlobClient.parseAttestation(resp.body.attestation);
	        }
	        
	        fn(null, resp.body);
	      } else if (resp.body) {
	        console.log('error:', 'attestation:', resp.body);
	        fn(new Error('attestation error: ' + resp.body.message || ""));
	      } else {
	        fn(new Error('attestation error'));
	      } 
	    });
	};

	/**
	 * parseAttestation
	 * @param {Object} attestation
	 */

	BlobClient.parseAttestation = function (attestation) {
	  var segments =  decodeURIComponent(attestation).split('.');
	  var decoded;
	  
	  // base64 decode and parse JSON
	  try {
	    decoded = {
	      header    : JSON.parse(crypt.decodeBase64(segments[0])),
	      payload   : JSON.parse(crypt.decodeBase64(segments[1])),
	      signature : segments[2]
	    }; 
	    
	  } catch (e) {
	    console.log("invalid attestation:", e);
	  }
	  
	  return decoded;
	};

	exports.BlobClient = BlobClient;


/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	var async      = __webpack_require__(8);
	var superagent = __webpack_require__(12);
	var RippleTxt  = __webpack_require__(5).RippleTxt;

	var AuthInfo = { };

	AuthInfo._getRippleTxt = function(domain, callback) {
	  RippleTxt.get(domain, callback);
	};

	AuthInfo._getUser = function(url, callback) {
	  superagent.get(url, callback);
	};


	/**
	 * Get auth info for a given address
	 *
	 * @param {string}    domain - Domain which hosts the user's info
	 * @param {string}    address - Address of user who's info we are retreiving
	 * @param {function}  fn - Callback function
	 */

	AuthInfo.getAddress = function(domain, address, callback) {
	  var self = this;
	  
	  function getRippleTxt(callback) {
	    self._getRippleTxt(domain, function(err, txt) {
	      if (err) {
	        return callback(err);
	      }

	      if (!txt.authinfo_url) {
	        return callback(new Error('Authentication is not supported on ' + domain));
	      }

	      var url = Array.isArray(txt.authinfo_url) ? txt.authinfo_url[0] : txt.authinfo_url;

	      url += '?domain=' + domain + '&username=' + address;

	      callback(null, url);
	    });
	  };

	  function getUserAddress(url, callback) {
	    self._getUser(url, function(err, res) {
	      if (err || res.error) {
	        callback(new Error('Authentication info server unreachable'));
	      } else {
	        callback(null, res.body);
	      }
	    });
	  };

	  async.waterfall([ getRippleTxt, getUserAddress ], callback);
	};

	/*
	  **
	 * Get auth info for a given username or ripple address
	 *
	 * @param {string}    domain - Domain which hosts the user's info
	 * @param {string}    address - Username or ripple address who's info we are retreiving
	 * @param {function}  fn - Callback function
	 */

	AuthInfo.get = function(domain, address, callback) {
	  var self = this;
	  
	  function getRippleTxt(callback) {
	    self._getRippleTxt(domain, function(err, txt) {
	      if (err) {
	        return callback(err);
	      }

	      if (!txt.authinfo_url) {
	        return callback(new Error('Authentication is not supported on ' + domain));
	      }

	      var url = Array.isArray(txt.authinfo_url) ? txt.authinfo_url[0] : txt.authinfo_url;

	      url += '?domain=' + domain + '&username=' + address;

	      callback(null, url);
	    });
	  };

	  function getUser(url, callback) {
	    self._getUser(url, function(err, res) {
	      if (err || res.error) {
	        callback(new Error('Authentication info server unreachable'));
	      } else {
	        callback(null, res.body);
	      }
	    });
	  };

	  async.waterfall([ getRippleTxt, getUser ], callback);
	};

	exports.AuthInfo = AuthInfo;


/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	var request   = __webpack_require__(12);
	var Currency  = ripple.Currency;

	var RippleTxt = {
	  txts : { }
	};

	RippleTxt.urlTemplates = [
	  'https://{{domain}}/ripple.txt',
	  'https://www.{{domain}}/ripple.txt',
	  'https://ripple.{{domain}}/ripple.txt',
	  'http://{{domain}}/ripple.txt',
	  'http://www.{{domain}}/ripple.txt',
	  'http://ripple.{{domain}}/ripple.txt'
	];

	/**
	 * Gets the ripple.txt file for the given domain
	 * @param {string}    domain - Domain to retrieve file from
	 * @param {function}  fn - Callback function
	 */

	RippleTxt.get = function(domain, fn) {
	  var self = this;

	  if (self.txts[domain]) {
	    return fn(null, self.txts[domain]);
	  }

	  ;(function nextUrl(i) {
	    var url = RippleTxt.urlTemplates[i];

	    if (!url) {
	      return fn(new Error('No ripple.txt found'));
	    }

	    url = url.replace('{{domain}}', domain);
	    console.log(url);
	    
	    request.get(url, function(err, resp) {
	      if (err || !resp.text) {
	        return nextUrl(++i);
	      }

	      var sections = self.parse(resp.text);
	      self.txts[domain] = sections;

	      fn(null, sections);
	    });
	  })(0);
	};

	/**
	 * Parse a ripple.txt file
	 * @param {string}  txt - Unparsed ripple.txt data
	 */

	RippleTxt.parse = function(txt) {
	  var currentSection = '';
	  var sections = { };
	  
	  txt = txt.replace(/\r?\n/g, '\n').split('\n');

	  for (var i = 0, l = txt.length; i < l; i++) {
	    var line = txt[i];

	    if (!line.length || line[0] === '#') {
	      continue;
	    }

	    if (line[0] === '[' && line[line.length - 1] === ']') {
	      currentSection = line.slice(1, line.length - 1);
	      sections[currentSection] = [];
	    } else {
	      line = line.replace(/^\s+|\s+$/g, '');
	      if (sections[currentSection]) {
	        sections[currentSection].push(line);
	      }
	    }
	  }

	  return sections;
	};

	/**
	 * extractDomain
	 * attempt to extract the domain from a given url
	 * returns the url if unsuccessful
	 * @param {Object} url
	 */

	RippleTxt.extractDomain = function (url) {
	  match = /[^.]*\.[^.]{2,3}(?:\.[^.]{2,3})?([^.\?][^\?.]+?)?$/.exec(url);
	  return match && match[0] ? match[0] : url;
	};

	/**
	 * getCurrencies
	 * returns domain, issuer account and currency object
	 * for each currency found in the domain's ripple.txt file
	 * @param {Object} domain
	 * @param {Object} fn
	 */

	RippleTxt.getCurrencies = function(domain, fn) {
	  var extracted = RippleTxt.extractDomain(domain);
	  var self      = this;
	  
	  //try with extracted domain
	  getCurrencies (extracted, function(err, resp) {
	    
	    //try with original domain
	    if (err) {
	      return getCurrencies(domain, fn);
	    
	    } else {
	      return fn (null, resp);
	    }
	  });
	  
	  function getCurrencies (domain, fn) {
	    self.get(domain, function(err, txt) {
	      if (err) {
	        return fn(err);  
	      }

	      if (err || !txt.currencies || !txt.accounts) {
	        return fn(null, []);
	      }

	      //NOTE: this won't be accurate if there are
	      //multiple issuer accounts with different 
	      //currencies associated with each.
	      var issuer     = txt.accounts[0];
	      var currencies = [];

	      txt.currencies.forEach(function(currency) {
	        currencies.push({
	          issuer   : issuer,
	          currency : Currency.from_json(currency),
	          domain   : domain
	        });
	      });

	      fn(null, currencies);
	    });
	  }
	}; 

	exports.RippleTxt = RippleTxt;


/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	var sjcl        = ripple.sjcl;
	var base        = ripple.Base;
	var Seed        = ripple.Seed;
	var UInt160     = ripple.UInt160;
	var UInt256     = ripple.UInt256;
	var request     = __webpack_require__(12);
	var querystring = __webpack_require__(11);
	var extend      = __webpack_require__(9);
	var parser      = __webpack_require__(10);
	var Crypt       = { };

	var SJCL_PARANOIA_256_BITS = 6;
	var cryptConfig = {
	  cipher : 'aes',
	  mode   : 'ccm',
	  ts     : 64,   // tag length
	  ks     : 256,  // key size
	  iter   : 1000  // iterations (key derivation)
	};

	/**
	 * Full domain hash based on SHA512
	 */

	function fdh(data, bytelen) {
	  var bitlen = bytelen << 3;

	  if (typeof data === 'string') {
	    data = sjcl.codec.utf8String.toBits(data);
	  }

	  // Add hashing rounds until we exceed desired length in bits
	  var counter = 0, output = [];

	  while (sjcl.bitArray.bitLength(output) < bitlen) {
	    var hash = sjcl.hash.sha512.hash(sjcl.bitArray.concat([counter], data));
	    output = sjcl.bitArray.concat(output, hash);
	    counter++;
	  }

	  // Truncate to desired length
	  output = sjcl.bitArray.clamp(output, bitlen);

	  return output;
	};

	/**
	 * This is a function to derive different hashes from the same key. 
	 * Each hash is derived as HMAC-SHA512HALF(key, token).
	 *
	 * @param {string} key
	 * @param {string} hash
	 */

	function keyHash(key, token) {
	  var hmac = new sjcl.misc.hmac(key, sjcl.hash.sha512);
	  return sjcl.codec.hex.fromBits(sjcl.bitArray.bitSlice(hmac.encrypt(token), 0, 256));
	};

	/**
	 * add entropy at each call to get random words
	 * @param {number} nWords
	 */
	function randomWords (nWords) {
	  return sjcl.random.randomWords(nWords, SJCL_PARANOIA_256_BITS);
	}

	/****** exposed functions ******/

	/**
	 * KEY DERIVATION FUNCTION
	 *
	 * This service takes care of the key derivation, i.e. converting low-entropy
	 * secret into higher entropy secret via either computationally expensive
	 * processes or peer-assisted key derivation (PAKDF).
	 *
	 * @param {object}    opts
	 * @param {string}    purpose - Key type/purpose
	 * @param {string}    username
	 * @param {string}    secret - Also known as passphrase/password
	 * @param {function}  fn
	 */

	Crypt.derive = function(opts, purpose, username, secret, fn) {
	  var tokens;

	  if (purpose === 'login') {
	    tokens = ['id', 'crypt'];
	  } else {
	    tokens = ['unlock'];
	  }

	  var iExponent = new sjcl.bn(String(opts.exponent));
	  var iModulus  = new sjcl.bn(String(opts.modulus));
	  var iAlpha    = new sjcl.bn(String(opts.alpha));

	  var publicInfo = [ 'PAKDF_1_0_0', opts.host.length, opts.host, username.length, username, purpose.length, purpose ].join(':') + ':';
	  var publicSize = Math.ceil(Math.min((7 + iModulus.bitLength()) >>> 3, 256) / 8);
	  var publicHash = fdh(publicInfo, publicSize);
	  var publicHex  = sjcl.codec.hex.fromBits(publicHash);
	  var iPublic    = new sjcl.bn(String(publicHex)).setBitM(0);
	  var secretInfo = [ publicInfo, secret.length, secret ].join(':') + ':';
	  var secretSize = (7 + iModulus.bitLength()) >>> 3;
	  var secretHash = fdh(secretInfo, secretSize);
	  var secretHex  = sjcl.codec.hex.fromBits(secretHash);
	  var iSecret    = new sjcl.bn(String(secretHex)).mod(iModulus);

	  if (iSecret.jacobi(iModulus) !== 1) {
	    iSecret = iSecret.mul(iAlpha).mod(iModulus);
	  }

	  var iRandom;

	  for (;;) {
	    iRandom = sjcl.bn.random(iModulus, SJCL_PARANOIA_256_BITS);
	    if (iRandom.jacobi(iModulus) === 1) {
	      break;
	    }
	  }

	  var iBlind   = iRandom.powermodMontgomery(iPublic.mul(iExponent), iModulus);
	  var iSignreq = iSecret.mulmod(iBlind, iModulus);
	  var signreq  = sjcl.codec.hex.fromBits(iSignreq.toBits());

	  request.post(opts.url)
	    .send({ info: publicInfo, signreq: signreq })
	    .end(function(err, resp) {
	      
	      if (err || !resp) {
	        return fn(new Error('Could not query PAKDF server ' + opts.host));
	      }

	      var data = resp.body || resp.text ? JSON.parse(resp.text) : {};

	      if (data.result !== 'success') {
	        return fn(new Error('Could not query PAKDF server '+opts.host));
	      }

	      var iSignres = new sjcl.bn(String(data.signres));
	      var iRandomInv = iRandom.inverseMod(iModulus);
	      var iSigned    = iSignres.mulmod(iRandomInv, iModulus);
	      var key        = iSigned.toBits();
	      var result     = { };

	      tokens.forEach(function(token) {
	        result[token] = keyHash(key, token);
	      });

	      fn(null, result);
	    });
	};

	/**
	 * Imported from ripple-client
	 */



	/**
	 * Encrypt data
	 *
	 * @param {string} key
	 * @param {string} data
	 */

	Crypt.encrypt = function(key, data) {
	  key = sjcl.codec.hex.toBits(key);

	  var opts = extend(true, {}, cryptConfig);

	  var encryptedObj = JSON.parse(sjcl.encrypt(key, data, opts));
	  var version = [sjcl.bitArray.partial(8, 0)];
	  var initVector = sjcl.codec.base64.toBits(encryptedObj.iv);
	  var ciphertext = sjcl.codec.base64.toBits(encryptedObj.ct);

	  var encryptedBits = sjcl.bitArray.concat(version, initVector);
	  encryptedBits = sjcl.bitArray.concat(encryptedBits, ciphertext);

	  return sjcl.codec.base64.fromBits(encryptedBits);
	};

	/**
	 * Decrypt data
	 *
	 * @param {string} key
	 * @param {string} data
	 */

	Crypt.decrypt = function (key, data) {
	  
	  key = sjcl.codec.hex.toBits(key);
	  var encryptedBits = sjcl.codec.base64.toBits(data);

	  var version = sjcl.bitArray.extract(encryptedBits, 0, 8);

	  if (version !== 0) {
	    throw new Error('Unsupported encryption version: '+version);
	  }

	  var encrypted = extend(true, {}, cryptConfig, {
	    iv: sjcl.codec.base64.fromBits(sjcl.bitArray.bitSlice(encryptedBits, 8, 8+128)),
	    ct: sjcl.codec.base64.fromBits(sjcl.bitArray.bitSlice(encryptedBits, 8+128))
	  });

	  return sjcl.decrypt(key, JSON.stringify(encrypted));
	};


	/**
	 * Validate a ripple address
	 *
	 * @param {string} address
	 */

	Crypt.isValidAddress = function (address) {
	  return UInt160.is_valid(address);
	};

	/**
	 * Create an encryption key
	 *
	 * @param {integer} nWords - number of words
	 */

	Crypt.createSecret = function (nWords) {
	  return sjcl.codec.hex.fromBits(randomWords(nWords));
	};

	/**
	 * Create a new master key
	 */

	Crypt.createMaster = function () {
	  return base.encode_check(33, sjcl.codec.bytes.fromBits(randomWords(4)));
	};


	/**
	 * Create a ripple address from a master key
	 *
	 * @param {string} masterkey
	 */

	Crypt.getAddress = function (masterkey) {
	  return Seed.from_json(masterkey).get_key().get_address().to_json();
	};

	/**
	 * Hash data using SHA-512.
	 *
	 * @param {string|bitArray} data
	 * @return {string} Hash of the data
	 */

	Crypt.hashSha512 = function (data) {
	  // XXX Should return a UInt512
	  return sjcl.codec.hex.fromBits(sjcl.hash.sha512.hash(data)); 
	};

	/**
	 * Hash data using SHA-512 and return the first 256 bits.
	 *
	 * @param {string|bitArray} data
	 * @return {UInt256} Hash of the data
	 */
	Crypt.hashSha512Half = function (data) {
	  return UInt256.from_hex(Crypt.hashSha512(data).substr(0, 64));
	};


	/**
	 * Sign a data string with a secret key
	 *
	 * @param {string} secret
	 * @param {string} data
	 */

	Crypt.signString = function(secret, data) {
	  var hmac = new sjcl.misc.hmac(sjcl.codec.hex.toBits(secret), sjcl.hash.sha512);
	  return sjcl.codec.hex.fromBits(hmac.mac(data));
	};

	/**
	 * Create an an accout recovery key
	 *
	 * @param {string} secret
	 */

	Crypt.deriveRecoveryEncryptionKeyFromSecret = function(secret) {
	  var seed = Seed.from_json(secret).to_bits();
	  var hmac = new sjcl.misc.hmac(seed, sjcl.hash.sha512);
	  var key  = hmac.mac('ripple/hmac/recovery_encryption_key/v1');
	  key      = sjcl.bitArray.bitSlice(key, 0, 256);
	  return sjcl.codec.hex.fromBits(key);
	};

	/**
	 * Convert base64 encoded data into base64url encoded data.
	 *
	 * @param {String} base64 Data
	 */

	Crypt.base64ToBase64Url = function(encodedData) {
	  return encodedData.replace(/\+/g, '-').replace(/\//g, '_').replace(/[=]+$/, '');
	};

	/**
	 * Convert base64url encoded data into base64 encoded data.
	 *
	 * @param {String} base64 Data
	 */

	Crypt.base64UrlToBase64 = function(encodedData) {
	  encodedData = encodedData.replace(/-/g, '+').replace(/_/g, '/');

	  while (encodedData.length % 4) {
	    encodedData += '=';
	  }

	  return encodedData;
	};

	/**
	 * base64 to UTF8
	 */

	Crypt.decodeBase64 = function (data) {
	  return sjcl.codec.utf8String.fromBits(sjcl.codec.base64.toBits(data));
	}

	exports.Crypt = Crypt;


/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	var Crypt   = __webpack_require__(6).Crypt;
	var Message = ripple.Message;
	var parser  = __webpack_require__(10);
	var extend  = __webpack_require__(9);
	var querystring = __webpack_require__(11);

	var SignedRequest = function (config) {
	  // XXX Constructor should be generalized and constructing from an Angular.js
	  //     $http config should be a SignedRequest.from... utility method.
	  this.config = extend(true, {}, config);
	  if (!this.config.data) this.config.data = {};
	};



	/**
	 * Create a string from request parameters that
	 * will be used to sign a request
	 * @param {Object} parsed - parsed url
	 * @param {Object} date 
	 * @param {Object} mechanism - type of signing
	 */
	SignedRequest.prototype.getStringToSign = function (parsed, date, mechanism) {
	  // XXX This method doesn't handle signing GET requests correctly. The data
	  //     field will be merged into the search string, not the request body.

	  // Sort the properties of the JSON object into canonical form
	  var canonicalData = JSON.stringify(copyObjectWithSortedKeys(this.config.data));

	  // Canonical request using Amazon's v4 signature format
	  // See: http://docs.aws.amazon.com/general/latest/gr/sigv4-create-canonical-request.html
	  var canonicalRequest = [
	    this.config.method || 'GET',
	    parsed.pathname || '',
	    parsed.search || '',
	    // XXX Headers signing not supported
	    '',
	    '',
	    Crypt.hashSha512(canonicalData).toLowerCase()
	  ].join('\n');

	  // String to sign inspired by Amazon's v4 signature format
	  // See: http://docs.aws.amazon.com/general/latest/gr/sigv4-create-string-to-sign.html
	  //
	  // We don't have a credential scope, so we skip it.
	  //
	  // But that modifies the format, so the format ID is RIPPLE1, instead of AWS4.
	  return [
	    mechanism,
	    date,
	    Crypt.hashSha512(canonicalRequest).toLowerCase()
	  ].join('\n');
	};

	//prepare for signing
	function copyObjectWithSortedKeys(object) {
	  if (isPlainObject(object)) {
	    var newObj = {};
	    var keysSorted = Object.keys(object).sort();
	    var key;
	    for (var i in keysSorted) {
	      key = keysSorted[i];
	      if (Object.prototype.hasOwnProperty.call(object, key)) {
	        newObj[key] = copyObjectWithSortedKeys(object[key]);
	      }
	    }
	    return newObj;
	  } else if (Array.isArray(object)) {
	    return object.map(copyObjectWithSortedKeys);
	  } else {
	    return object;
	  }
	}

	//from npm extend
	function isPlainObject(obj) {
	  var hasOwn = Object.prototype.hasOwnProperty;
	  var toString = Object.prototype.toString;

	  if (!obj || toString.call(obj) !== '[object Object]' || obj.nodeType || obj.setInterval)
	    return false;

	  var has_own_constructor = hasOwn.call(obj, 'constructor');
	  var has_is_property_of_method = hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
	  // Not own constructor property must be Object
	  if (obj.constructor && !has_own_constructor && !has_is_property_of_method)
	    return false;

	  // Own properties are enumerated firstly, so to speed up,
	  // if last one is own, then all properties are own.
	  var key;
	  for ( key in obj ) {}

	  return key === undefined || hasOwn.call( obj, key );
	};

	/**
	 * HMAC signed request
	 * @param {Object} config
	 * @param {Object} auth_secret
	 * @param {Object} blob_id
	 */
	SignedRequest.prototype.signHmac = function (auth_secret, blob_id) {
	  var config = extend(true, {}, this.config);

	  // Parse URL
	  var parsed        = parser.parse(config.url);
	  var date          = dateAsIso8601();
	  var signatureType = 'RIPPLE1-HMAC-SHA512';
	  var stringToSign  = this.getStringToSign(parsed, date, signatureType);
	  var signature     = Crypt.signString(auth_secret, stringToSign);

	  var query = querystring.stringify({
	    signature: Crypt.base64ToBase64Url(signature),
	    signature_date: date,
	    signature_blob_id: blob_id,
	    signature_type: signatureType
	  });

	  config.url += (parsed.search ? '&' : '?') + query;
	  return config;
	};

	/**
	 * Asymmetric signed request
	 * @param {Object} config
	 * @param {Object} secretKey
	 * @param {Object} account
	 * @param {Object} blob_id
	 */
	SignedRequest.prototype.signAsymmetric = function (secretKey, account, blob_id) {
	  var config = extend(true, {}, this.config);

	  // Parse URL
	  var parsed        = parser.parse(config.url);
	  var date          = dateAsIso8601();
	  var signatureType = 'RIPPLE1-ECDSA-SHA512';
	  var stringToSign  = this.getStringToSign(parsed, date, signatureType);
	  var signature     = Message.signMessage(stringToSign, secretKey);
	 
	  var query = querystring.stringify({
	    signature: Crypt.base64ToBase64Url(signature),
	    signature_date: date,
	    signature_blob_id: blob_id,
	    signature_account: account,
	    signature_type: signatureType
	  });

	  config.url += (parsed.search ? '&' : '?') + query;

	  return config;
	};

	/**
	 * Asymmetric signed request for vault recovery
	 * @param {Object} config
	 * @param {Object} secretKey
	 * @param {Object} username
	 */
	SignedRequest.prototype.signAsymmetricRecovery = function (secretKey, username) {
	  var config = extend(true, {}, this.config);

	  // Parse URL
	  var parsed        = parser.parse(config.url);
	  var date          = dateAsIso8601();
	  var signatureType = 'RIPPLE1-ECDSA-SHA512';
	  var stringToSign  = this.getStringToSign(parsed, date, signatureType);
	  var signature     = Message.signMessage(stringToSign, secretKey);
	 
	  var query = querystring.stringify({
	    signature: Crypt.base64ToBase64Url(signature),
	    signature_date: date,
	    signature_username: username,
	    signature_type: signatureType
	  });

	  config.url += (parsed.search ? '&' : '?') + query;

	  return config;
	};

	var dateAsIso8601 = (function () {
	  function pad(n) {
	    return (n < 0 || n > 9 ? "" : "0") + n;
	  }

	  return function dateAsIso8601() {
	    var date = new Date();
	    return date.getUTCFullYear() + "-" +
	      pad(date.getUTCMonth()     + 1)  + "-" +
	      pad(date.getUTCDate())     + "T" +
	      pad(date.getUTCHours())    + ":" +
	      pad(date.getUTCMinutes())  + ":" +
	      pad(date.getUTCSeconds())  + ".000Z";
	  };
	})();

	// XXX Add methods for verifying requests
	// SignedRequest.prototype.verifySignatureHmac
	// SignedRequest.prototype.verifySignatureAsymetric

	exports.SignedRequest = SignedRequest;



/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/* WEBPACK VAR INJECTION */(function(process) {/*!
	 * async
	 * https://github.com/caolan/async
	 *
	 * Copyright 2010-2014 Caolan McMahon
	 * Released under the MIT license
	 */
	/*jshint onevar: false, indent:4 */
	/*global setImmediate: false, setTimeout: false, console: false */
	(function () {

	    var async = {};

	    // global on the server, window in the browser
	    var root, previous_async;

	    root = this;
	    if (root != null) {
	      previous_async = root.async;
	    }

	    async.noConflict = function () {
	        root.async = previous_async;
	        return async;
	    };

	    function only_once(fn) {
	        var called = false;
	        return function() {
	            if (called) throw new Error("Callback was already called.");
	            called = true;
	            fn.apply(root, arguments);
	        }
	    }

	    //// cross-browser compatiblity functions ////

	    var _toString = Object.prototype.toString;

	    var _isArray = Array.isArray || function (obj) {
	        return _toString.call(obj) === '[object Array]';
	    };

	    var _each = function (arr, iterator) {
	        if (arr.forEach) {
	            return arr.forEach(iterator);
	        }
	        for (var i = 0; i < arr.length; i += 1) {
	            iterator(arr[i], i, arr);
	        }
	    };

	    var _map = function (arr, iterator) {
	        if (arr.map) {
	            return arr.map(iterator);
	        }
	        var results = [];
	        _each(arr, function (x, i, a) {
	            results.push(iterator(x, i, a));
	        });
	        return results;
	    };

	    var _reduce = function (arr, iterator, memo) {
	        if (arr.reduce) {
	            return arr.reduce(iterator, memo);
	        }
	        _each(arr, function (x, i, a) {
	            memo = iterator(memo, x, i, a);
	        });
	        return memo;
	    };

	    var _keys = function (obj) {
	        if (Object.keys) {
	            return Object.keys(obj);
	        }
	        var keys = [];
	        for (var k in obj) {
	            if (obj.hasOwnProperty(k)) {
	                keys.push(k);
	            }
	        }
	        return keys;
	    };

	    //// exported async module functions ////

	    //// nextTick implementation with browser-compatible fallback ////
	    if (typeof process === 'undefined' || !(process.nextTick)) {
	        if (typeof setImmediate === 'function') {
	            async.nextTick = function (fn) {
	                // not a direct alias for IE10 compatibility
	                setImmediate(fn);
	            };
	            async.setImmediate = async.nextTick;
	        }
	        else {
	            async.nextTick = function (fn) {
	                setTimeout(fn, 0);
	            };
	            async.setImmediate = async.nextTick;
	        }
	    }
	    else {
	        async.nextTick = process.nextTick;
	        if (typeof setImmediate !== 'undefined') {
	            async.setImmediate = function (fn) {
	              // not a direct alias for IE10 compatibility
	              setImmediate(fn);
	            };
	        }
	        else {
	            async.setImmediate = async.nextTick;
	        }
	    }

	    async.each = function (arr, iterator, callback) {
	        callback = callback || function () {};
	        if (!arr.length) {
	            return callback();
	        }
	        var completed = 0;
	        _each(arr, function (x) {
	            iterator(x, only_once(done) );
	        });
	        function done(err) {
	          if (err) {
	              callback(err);
	              callback = function () {};
	          }
	          else {
	              completed += 1;
	              if (completed >= arr.length) {
	                  callback();
	              }
	          }
	        }
	    };
	    async.forEach = async.each;

	    async.eachSeries = function (arr, iterator, callback) {
	        callback = callback || function () {};
	        if (!arr.length) {
	            return callback();
	        }
	        var completed = 0;
	        var iterate = function () {
	            iterator(arr[completed], function (err) {
	                if (err) {
	                    callback(err);
	                    callback = function () {};
	                }
	                else {
	                    completed += 1;
	                    if (completed >= arr.length) {
	                        callback();
	                    }
	                    else {
	                        iterate();
	                    }
	                }
	            });
	        };
	        iterate();
	    };
	    async.forEachSeries = async.eachSeries;

	    async.eachLimit = function (arr, limit, iterator, callback) {
	        var fn = _eachLimit(limit);
	        fn.apply(null, [arr, iterator, callback]);
	    };
	    async.forEachLimit = async.eachLimit;

	    var _eachLimit = function (limit) {

	        return function (arr, iterator, callback) {
	            callback = callback || function () {};
	            if (!arr.length || limit <= 0) {
	                return callback();
	            }
	            var completed = 0;
	            var started = 0;
	            var running = 0;

	            (function replenish () {
	                if (completed >= arr.length) {
	                    return callback();
	                }

	                while (running < limit && started < arr.length) {
	                    started += 1;
	                    running += 1;
	                    iterator(arr[started - 1], function (err) {
	                        if (err) {
	                            callback(err);
	                            callback = function () {};
	                        }
	                        else {
	                            completed += 1;
	                            running -= 1;
	                            if (completed >= arr.length) {
	                                callback();
	                            }
	                            else {
	                                replenish();
	                            }
	                        }
	                    });
	                }
	            })();
	        };
	    };


	    var doParallel = function (fn) {
	        return function () {
	            var args = Array.prototype.slice.call(arguments);
	            return fn.apply(null, [async.each].concat(args));
	        };
	    };
	    var doParallelLimit = function(limit, fn) {
	        return function () {
	            var args = Array.prototype.slice.call(arguments);
	            return fn.apply(null, [_eachLimit(limit)].concat(args));
	        };
	    };
	    var doSeries = function (fn) {
	        return function () {
	            var args = Array.prototype.slice.call(arguments);
	            return fn.apply(null, [async.eachSeries].concat(args));
	        };
	    };


	    var _asyncMap = function (eachfn, arr, iterator, callback) {
	        arr = _map(arr, function (x, i) {
	            return {index: i, value: x};
	        });
	        if (!callback) {
	            eachfn(arr, function (x, callback) {
	                iterator(x.value, function (err) {
	                    callback(err);
	                });
	            });
	        } else {
	            var results = [];
	            eachfn(arr, function (x, callback) {
	                iterator(x.value, function (err, v) {
	                    results[x.index] = v;
	                    callback(err);
	                });
	            }, function (err) {
	                callback(err, results);
	            });
	        }
	    };
	    async.map = doParallel(_asyncMap);
	    async.mapSeries = doSeries(_asyncMap);
	    async.mapLimit = function (arr, limit, iterator, callback) {
	        return _mapLimit(limit)(arr, iterator, callback);
	    };

	    var _mapLimit = function(limit) {
	        return doParallelLimit(limit, _asyncMap);
	    };

	    // reduce only has a series version, as doing reduce in parallel won't
	    // work in many situations.
	    async.reduce = function (arr, memo, iterator, callback) {
	        async.eachSeries(arr, function (x, callback) {
	            iterator(memo, x, function (err, v) {
	                memo = v;
	                callback(err);
	            });
	        }, function (err) {
	            callback(err, memo);
	        });
	    };
	    // inject alias
	    async.inject = async.reduce;
	    // foldl alias
	    async.foldl = async.reduce;

	    async.reduceRight = function (arr, memo, iterator, callback) {
	        var reversed = _map(arr, function (x) {
	            return x;
	        }).reverse();
	        async.reduce(reversed, memo, iterator, callback);
	    };
	    // foldr alias
	    async.foldr = async.reduceRight;

	    var _filter = function (eachfn, arr, iterator, callback) {
	        var results = [];
	        arr = _map(arr, function (x, i) {
	            return {index: i, value: x};
	        });
	        eachfn(arr, function (x, callback) {
	            iterator(x.value, function (v) {
	                if (v) {
	                    results.push(x);
	                }
	                callback();
	            });
	        }, function (err) {
	            callback(_map(results.sort(function (a, b) {
	                return a.index - b.index;
	            }), function (x) {
	                return x.value;
	            }));
	        });
	    };
	    async.filter = doParallel(_filter);
	    async.filterSeries = doSeries(_filter);
	    // select alias
	    async.select = async.filter;
	    async.selectSeries = async.filterSeries;

	    var _reject = function (eachfn, arr, iterator, callback) {
	        var results = [];
	        arr = _map(arr, function (x, i) {
	            return {index: i, value: x};
	        });
	        eachfn(arr, function (x, callback) {
	            iterator(x.value, function (v) {
	                if (!v) {
	                    results.push(x);
	                }
	                callback();
	            });
	        }, function (err) {
	            callback(_map(results.sort(function (a, b) {
	                return a.index - b.index;
	            }), function (x) {
	                return x.value;
	            }));
	        });
	    };
	    async.reject = doParallel(_reject);
	    async.rejectSeries = doSeries(_reject);

	    var _detect = function (eachfn, arr, iterator, main_callback) {
	        eachfn(arr, function (x, callback) {
	            iterator(x, function (result) {
	                if (result) {
	                    main_callback(x);
	                    main_callback = function () {};
	                }
	                else {
	                    callback();
	                }
	            });
	        }, function (err) {
	            main_callback();
	        });
	    };
	    async.detect = doParallel(_detect);
	    async.detectSeries = doSeries(_detect);

	    async.some = function (arr, iterator, main_callback) {
	        async.each(arr, function (x, callback) {
	            iterator(x, function (v) {
	                if (v) {
	                    main_callback(true);
	                    main_callback = function () {};
	                }
	                callback();
	            });
	        }, function (err) {
	            main_callback(false);
	        });
	    };
	    // any alias
	    async.any = async.some;

	    async.every = function (arr, iterator, main_callback) {
	        async.each(arr, function (x, callback) {
	            iterator(x, function (v) {
	                if (!v) {
	                    main_callback(false);
	                    main_callback = function () {};
	                }
	                callback();
	            });
	        }, function (err) {
	            main_callback(true);
	        });
	    };
	    // all alias
	    async.all = async.every;

	    async.sortBy = function (arr, iterator, callback) {
	        async.map(arr, function (x, callback) {
	            iterator(x, function (err, criteria) {
	                if (err) {
	                    callback(err);
	                }
	                else {
	                    callback(null, {value: x, criteria: criteria});
	                }
	            });
	        }, function (err, results) {
	            if (err) {
	                return callback(err);
	            }
	            else {
	                var fn = function (left, right) {
	                    var a = left.criteria, b = right.criteria;
	                    return a < b ? -1 : a > b ? 1 : 0;
	                };
	                callback(null, _map(results.sort(fn), function (x) {
	                    return x.value;
	                }));
	            }
	        });
	    };

	    async.auto = function (tasks, callback) {
	        callback = callback || function () {};
	        var keys = _keys(tasks);
	        var remainingTasks = keys.length
	        if (!remainingTasks) {
	            return callback();
	        }

	        var results = {};

	        var listeners = [];
	        var addListener = function (fn) {
	            listeners.unshift(fn);
	        };
	        var removeListener = function (fn) {
	            for (var i = 0; i < listeners.length; i += 1) {
	                if (listeners[i] === fn) {
	                    listeners.splice(i, 1);
	                    return;
	                }
	            }
	        };
	        var taskComplete = function () {
	            remainingTasks--
	            _each(listeners.slice(0), function (fn) {
	                fn();
	            });
	        };

	        addListener(function () {
	            if (!remainingTasks) {
	                var theCallback = callback;
	                // prevent final callback from calling itself if it errors
	                callback = function () {};

	                theCallback(null, results);
	            }
	        });

	        _each(keys, function (k) {
	            var task = _isArray(tasks[k]) ? tasks[k]: [tasks[k]];
	            var taskCallback = function (err) {
	                var args = Array.prototype.slice.call(arguments, 1);
	                if (args.length <= 1) {
	                    args = args[0];
	                }
	                if (err) {
	                    var safeResults = {};
	                    _each(_keys(results), function(rkey) {
	                        safeResults[rkey] = results[rkey];
	                    });
	                    safeResults[k] = args;
	                    callback(err, safeResults);
	                    // stop subsequent errors hitting callback multiple times
	                    callback = function () {};
	                }
	                else {
	                    results[k] = args;
	                    async.setImmediate(taskComplete);
	                }
	            };
	            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
	            var ready = function () {
	                return _reduce(requires, function (a, x) {
	                    return (a && results.hasOwnProperty(x));
	                }, true) && !results.hasOwnProperty(k);
	            };
	            if (ready()) {
	                task[task.length - 1](taskCallback, results);
	            }
	            else {
	                var listener = function () {
	                    if (ready()) {
	                        removeListener(listener);
	                        task[task.length - 1](taskCallback, results);
	                    }
	                };
	                addListener(listener);
	            }
	        });
	    };

	    async.retry = function(times, task, callback) {
	        var DEFAULT_TIMES = 5;
	        var attempts = [];
	        // Use defaults if times not passed
	        if (typeof times === 'function') {
	            callback = task;
	            task = times;
	            times = DEFAULT_TIMES;
	        }
	        // Make sure times is a number
	        times = parseInt(times, 10) || DEFAULT_TIMES;
	        var wrappedTask = function(wrappedCallback, wrappedResults) {
	            var retryAttempt = function(task, finalAttempt) {
	                return function(seriesCallback) {
	                    task(function(err, result){
	                        seriesCallback(!err || finalAttempt, {err: err, result: result});
	                    }, wrappedResults);
	                };
	            };
	            while (times) {
	                attempts.push(retryAttempt(task, !(times-=1)));
	            }
	            async.series(attempts, function(done, data){
	                data = data[data.length - 1];
	                (wrappedCallback || callback)(data.err, data.result);
	            });
	        }
	        // If a callback is passed, run this as a controll flow
	        return callback ? wrappedTask() : wrappedTask
	    };

	    async.waterfall = function (tasks, callback) {
	        callback = callback || function () {};
	        if (!_isArray(tasks)) {
	          var err = new Error('First argument to waterfall must be an array of functions');
	          return callback(err);
	        }
	        if (!tasks.length) {
	            return callback();
	        }
	        var wrapIterator = function (iterator) {
	            return function (err) {
	                if (err) {
	                    callback.apply(null, arguments);
	                    callback = function () {};
	                }
	                else {
	                    var args = Array.prototype.slice.call(arguments, 1);
	                    var next = iterator.next();
	                    if (next) {
	                        args.push(wrapIterator(next));
	                    }
	                    else {
	                        args.push(callback);
	                    }
	                    async.setImmediate(function () {
	                        iterator.apply(null, args);
	                    });
	                }
	            };
	        };
	        wrapIterator(async.iterator(tasks))();
	    };

	    var _parallel = function(eachfn, tasks, callback) {
	        callback = callback || function () {};
	        if (_isArray(tasks)) {
	            eachfn.map(tasks, function (fn, callback) {
	                if (fn) {
	                    fn(function (err) {
	                        var args = Array.prototype.slice.call(arguments, 1);
	                        if (args.length <= 1) {
	                            args = args[0];
	                        }
	                        callback.call(null, err, args);
	                    });
	                }
	            }, callback);
	        }
	        else {
	            var results = {};
	            eachfn.each(_keys(tasks), function (k, callback) {
	                tasks[k](function (err) {
	                    var args = Array.prototype.slice.call(arguments, 1);
	                    if (args.length <= 1) {
	                        args = args[0];
	                    }
	                    results[k] = args;
	                    callback(err);
	                });
	            }, function (err) {
	                callback(err, results);
	            });
	        }
	    };

	    async.parallel = function (tasks, callback) {
	        _parallel({ map: async.map, each: async.each }, tasks, callback);
	    };

	    async.parallelLimit = function(tasks, limit, callback) {
	        _parallel({ map: _mapLimit(limit), each: _eachLimit(limit) }, tasks, callback);
	    };

	    async.series = function (tasks, callback) {
	        callback = callback || function () {};
	        if (_isArray(tasks)) {
	            async.mapSeries(tasks, function (fn, callback) {
	                if (fn) {
	                    fn(function (err) {
	                        var args = Array.prototype.slice.call(arguments, 1);
	                        if (args.length <= 1) {
	                            args = args[0];
	                        }
	                        callback.call(null, err, args);
	                    });
	                }
	            }, callback);
	        }
	        else {
	            var results = {};
	            async.eachSeries(_keys(tasks), function (k, callback) {
	                tasks[k](function (err) {
	                    var args = Array.prototype.slice.call(arguments, 1);
	                    if (args.length <= 1) {
	                        args = args[0];
	                    }
	                    results[k] = args;
	                    callback(err);
	                });
	            }, function (err) {
	                callback(err, results);
	            });
	        }
	    };

	    async.iterator = function (tasks) {
	        var makeCallback = function (index) {
	            var fn = function () {
	                if (tasks.length) {
	                    tasks[index].apply(null, arguments);
	                }
	                return fn.next();
	            };
	            fn.next = function () {
	                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
	            };
	            return fn;
	        };
	        return makeCallback(0);
	    };

	    async.apply = function (fn) {
	        var args = Array.prototype.slice.call(arguments, 1);
	        return function () {
	            return fn.apply(
	                null, args.concat(Array.prototype.slice.call(arguments))
	            );
	        };
	    };

	    var _concat = function (eachfn, arr, fn, callback) {
	        var r = [];
	        eachfn(arr, function (x, cb) {
	            fn(x, function (err, y) {
	                r = r.concat(y || []);
	                cb(err);
	            });
	        }, function (err) {
	            callback(err, r);
	        });
	    };
	    async.concat = doParallel(_concat);
	    async.concatSeries = doSeries(_concat);

	    async.whilst = function (test, iterator, callback) {
	        if (test()) {
	            iterator(function (err) {
	                if (err) {
	                    return callback(err);
	                }
	                async.whilst(test, iterator, callback);
	            });
	        }
	        else {
	            callback();
	        }
	    };

	    async.doWhilst = function (iterator, test, callback) {
	        iterator(function (err) {
	            if (err) {
	                return callback(err);
	            }
	            var args = Array.prototype.slice.call(arguments, 1);
	            if (test.apply(null, args)) {
	                async.doWhilst(iterator, test, callback);
	            }
	            else {
	                callback();
	            }
	        });
	    };

	    async.until = function (test, iterator, callback) {
	        if (!test()) {
	            iterator(function (err) {
	                if (err) {
	                    return callback(err);
	                }
	                async.until(test, iterator, callback);
	            });
	        }
	        else {
	            callback();
	        }
	    };

	    async.doUntil = function (iterator, test, callback) {
	        iterator(function (err) {
	            if (err) {
	                return callback(err);
	            }
	            var args = Array.prototype.slice.call(arguments, 1);
	            if (!test.apply(null, args)) {
	                async.doUntil(iterator, test, callback);
	            }
	            else {
	                callback();
	            }
	        });
	    };

	    async.queue = function (worker, concurrency) {
	        if (concurrency === undefined) {
	            concurrency = 1;
	        }
	        function _insert(q, data, pos, callback) {
	          if (!q.started){
	            q.started = true;
	          }
	          if (!_isArray(data)) {
	              data = [data];
	          }
	          if(data.length == 0) {
	             // call drain immediately if there are no tasks
	             return async.setImmediate(function() {
	                 if (q.drain) {
	                     q.drain();
	                 }
	             });
	          }
	          _each(data, function(task) {
	              var item = {
	                  data: task,
	                  callback: typeof callback === 'function' ? callback : null
	              };

	              if (pos) {
	                q.tasks.unshift(item);
	              } else {
	                q.tasks.push(item);
	              }

	              if (q.saturated && q.tasks.length === q.concurrency) {
	                  q.saturated();
	              }
	              async.setImmediate(q.process);
	          });
	        }

	        var workers = 0;
	        var q = {
	            tasks: [],
	            concurrency: concurrency,
	            saturated: null,
	            empty: null,
	            drain: null,
	            started: false,
	            paused: false,
	            push: function (data, callback) {
	              _insert(q, data, false, callback);
	            },
	            kill: function () {
	              q.drain = null;
	              q.tasks = [];
	            },
	            unshift: function (data, callback) {
	              _insert(q, data, true, callback);
	            },
	            process: function () {
	                if (!q.paused && workers < q.concurrency && q.tasks.length) {
	                    var task = q.tasks.shift();
	                    if (q.empty && q.tasks.length === 0) {
	                        q.empty();
	                    }
	                    workers += 1;
	                    var next = function () {
	                        workers -= 1;
	                        if (task.callback) {
	                            task.callback.apply(task, arguments);
	                        }
	                        if (q.drain && q.tasks.length + workers === 0) {
	                            q.drain();
	                        }
	                        q.process();
	                    };
	                    var cb = only_once(next);
	                    worker(task.data, cb);
	                }
	            },
	            length: function () {
	                return q.tasks.length;
	            },
	            running: function () {
	                return workers;
	            },
	            idle: function() {
	                return q.tasks.length + workers === 0;
	            },
	            pause: function () {
	                if (q.paused === true) { return; }
	                q.paused = true;
	                q.process();
	            },
	            resume: function () {
	                if (q.paused === false) { return; }
	                q.paused = false;
	                q.process();
	            }
	        };
	        return q;
	    };
	    
	    async.priorityQueue = function (worker, concurrency) {
	        
	        function _compareTasks(a, b){
	          return a.priority - b.priority;
	        };
	        
	        function _binarySearch(sequence, item, compare) {
	          var beg = -1,
	              end = sequence.length - 1;
	          while (beg < end) {
	            var mid = beg + ((end - beg + 1) >>> 1);
	            if (compare(item, sequence[mid]) >= 0) {
	              beg = mid;
	            } else {
	              end = mid - 1;
	            }
	          }
	          return beg;
	        }
	        
	        function _insert(q, data, priority, callback) {
	          if (!q.started){
	            q.started = true;
	          }
	          if (!_isArray(data)) {
	              data = [data];
	          }
	          if(data.length == 0) {
	             // call drain immediately if there are no tasks
	             return async.setImmediate(function() {
	                 if (q.drain) {
	                     q.drain();
	                 }
	             });
	          }
	          _each(data, function(task) {
	              var item = {
	                  data: task,
	                  priority: priority,
	                  callback: typeof callback === 'function' ? callback : null
	              };
	              
	              q.tasks.splice(_binarySearch(q.tasks, item, _compareTasks) + 1, 0, item);

	              if (q.saturated && q.tasks.length === q.concurrency) {
	                  q.saturated();
	              }
	              async.setImmediate(q.process);
	          });
	        }
	        
	        // Start with a normal queue
	        var q = async.queue(worker, concurrency);
	        
	        // Override push to accept second parameter representing priority
	        q.push = function (data, priority, callback) {
	          _insert(q, data, priority, callback);
	        };
	        
	        // Remove unshift function
	        delete q.unshift;

	        return q;
	    };

	    async.cargo = function (worker, payload) {
	        var working     = false,
	            tasks       = [];

	        var cargo = {
	            tasks: tasks,
	            payload: payload,
	            saturated: null,
	            empty: null,
	            drain: null,
	            drained: true,
	            push: function (data, callback) {
	                if (!_isArray(data)) {
	                    data = [data];
	                }
	                _each(data, function(task) {
	                    tasks.push({
	                        data: task,
	                        callback: typeof callback === 'function' ? callback : null
	                    });
	                    cargo.drained = false;
	                    if (cargo.saturated && tasks.length === payload) {
	                        cargo.saturated();
	                    }
	                });
	                async.setImmediate(cargo.process);
	            },
	            process: function process() {
	                if (working) return;
	                if (tasks.length === 0) {
	                    if(cargo.drain && !cargo.drained) cargo.drain();
	                    cargo.drained = true;
	                    return;
	                }

	                var ts = typeof payload === 'number'
	                            ? tasks.splice(0, payload)
	                            : tasks.splice(0, tasks.length);

	                var ds = _map(ts, function (task) {
	                    return task.data;
	                });

	                if(cargo.empty) cargo.empty();
	                working = true;
	                worker(ds, function () {
	                    working = false;

	                    var args = arguments;
	                    _each(ts, function (data) {
	                        if (data.callback) {
	                            data.callback.apply(null, args);
	                        }
	                    });

	                    process();
	                });
	            },
	            length: function () {
	                return tasks.length;
	            },
	            running: function () {
	                return working;
	            }
	        };
	        return cargo;
	    };

	    var _console_fn = function (name) {
	        return function (fn) {
	            var args = Array.prototype.slice.call(arguments, 1);
	            fn.apply(null, args.concat([function (err) {
	                var args = Array.prototype.slice.call(arguments, 1);
	                if (typeof console !== 'undefined') {
	                    if (err) {
	                        if (console.error) {
	                            console.error(err);
	                        }
	                    }
	                    else if (console[name]) {
	                        _each(args, function (x) {
	                            console[name](x);
	                        });
	                    }
	                }
	            }]));
	        };
	    };
	    async.log = _console_fn('log');
	    async.dir = _console_fn('dir');
	    /*async.info = _console_fn('info');
	    async.warn = _console_fn('warn');
	    async.error = _console_fn('error');*/

	    async.memoize = function (fn, hasher) {
	        var memo = {};
	        var queues = {};
	        hasher = hasher || function (x) {
	            return x;
	        };
	        var memoized = function () {
	            var args = Array.prototype.slice.call(arguments);
	            var callback = args.pop();
	            var key = hasher.apply(null, args);
	            if (key in memo) {
	                async.nextTick(function () {
	                    callback.apply(null, memo[key]);
	                });
	            }
	            else if (key in queues) {
	                queues[key].push(callback);
	            }
	            else {
	                queues[key] = [callback];
	                fn.apply(null, args.concat([function () {
	                    memo[key] = arguments;
	                    var q = queues[key];
	                    delete queues[key];
	                    for (var i = 0, l = q.length; i < l; i++) {
	                      q[i].apply(null, arguments);
	                    }
	                }]));
	            }
	        };
	        memoized.memo = memo;
	        memoized.unmemoized = fn;
	        return memoized;
	    };

	    async.unmemoize = function (fn) {
	      return function () {
	        return (fn.unmemoized || fn).apply(null, arguments);
	      };
	    };

	    async.times = function (count, iterator, callback) {
	        var counter = [];
	        for (var i = 0; i < count; i++) {
	            counter.push(i);
	        }
	        return async.map(counter, iterator, callback);
	    };

	    async.timesSeries = function (count, iterator, callback) {
	        var counter = [];
	        for (var i = 0; i < count; i++) {
	            counter.push(i);
	        }
	        return async.mapSeries(counter, iterator, callback);
	    };

	    async.seq = function (/* functions... */) {
	        var fns = arguments;
	        return function () {
	            var that = this;
	            var args = Array.prototype.slice.call(arguments);
	            var callback = args.pop();
	            async.reduce(fns, args, function (newargs, fn, cb) {
	                fn.apply(that, newargs.concat([function () {
	                    var err = arguments[0];
	                    var nextargs = Array.prototype.slice.call(arguments, 1);
	                    cb(err, nextargs);
	                }]))
	            },
	            function (err, results) {
	                callback.apply(that, [err].concat(results));
	            });
	        };
	    };

	    async.compose = function (/* functions... */) {
	      return async.seq.apply(null, Array.prototype.reverse.call(arguments));
	    };

	    var _applyEach = function (eachfn, fns /*args...*/) {
	        var go = function () {
	            var that = this;
	            var args = Array.prototype.slice.call(arguments);
	            var callback = args.pop();
	            return eachfn(fns, function (fn, cb) {
	                fn.apply(that, args.concat([cb]));
	            },
	            callback);
	        };
	        if (arguments.length > 2) {
	            var args = Array.prototype.slice.call(arguments, 2);
	            return go.apply(this, args);
	        }
	        else {
	            return go;
	        }
	    };
	    async.applyEach = doParallel(_applyEach);
	    async.applyEachSeries = doSeries(_applyEach);

	    async.forever = function (fn, callback) {
	        function next(err) {
	            if (err) {
	                if (callback) {
	                    return callback(err);
	                }
	                throw err;
	            }
	            fn(next);
	        }
	        next();
	    };

	    // Node.js
	    if (typeof module !== 'undefined' && module.exports) {
	        module.exports = async;
	    }
	    // AMD / RequireJS
	    else if (true) {
	        !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = function () {
	            return async;
	        }.apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
	    }
	    // included directly via <script> tag
	    else {
	        root.async = async;
	    }

	}());
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(15)))

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	var hasOwn = Object.prototype.hasOwnProperty;
	var toString = Object.prototype.toString;
	var undefined;

	var isPlainObject = function isPlainObject(obj) {
		'use strict';
		if (!obj || toString.call(obj) !== '[object Object]') {
			return false;
		}

		var has_own_constructor = hasOwn.call(obj, 'constructor');
		var has_is_property_of_method = obj.constructor && obj.constructor.prototype && hasOwn.call(obj.constructor.prototype, 'isPrototypeOf');
		// Not own constructor property must be Object
		if (obj.constructor && !has_own_constructor && !has_is_property_of_method) {
			return false;
		}

		// Own properties are enumerated firstly, so to speed up,
		// if last one is own, then all properties are own.
		var key;
		for (key in obj) {}

		return key === undefined || hasOwn.call(obj, key);
	};

	module.exports = function extend() {
		'use strict';
		var options, name, src, copy, copyIsArray, clone,
			target = arguments[0],
			i = 1,
			length = arguments.length,
			deep = false;

		// Handle a deep copy situation
		if (typeof target === 'boolean') {
			deep = target;
			target = arguments[1] || {};
			// skip the boolean and the target
			i = 2;
		} else if ((typeof target !== 'object' && typeof target !== 'function') || target == null) {
			target = {};
		}

		for (; i < length; ++i) {
			options = arguments[i];
			// Only deal with non-null/undefined values
			if (options != null) {
				// Extend the base object
				for (name in options) {
					src = target[name];
					copy = options[name];

					// Prevent never-ending loop
					if (target === copy) {
						continue;
					}

					// Recurse if we're merging plain objects or arrays
					if (deep && copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
						if (copyIsArray) {
							copyIsArray = false;
							clone = src && Array.isArray(src) ? src : [];
						} else {
							clone = src && isPlainObject(src) ? src : {};
						}

						// Never move original objects, clone them
						target[name] = extend(deep, clone, copy);

					// Don't bring in undefined values
					} else if (copy !== undefined) {
						target[name] = copy;
					}
				}
			}
		}

		// Return the modified object
		return target;
	};



/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	var punycode = __webpack_require__(16);

	exports.parse = urlParse;
	exports.resolve = urlResolve;
	exports.resolveObject = urlResolveObject;
	exports.format = urlFormat;

	exports.Url = Url;

	function Url() {
	  this.protocol = null;
	  this.slashes = null;
	  this.auth = null;
	  this.host = null;
	  this.port = null;
	  this.hostname = null;
	  this.hash = null;
	  this.search = null;
	  this.query = null;
	  this.pathname = null;
	  this.path = null;
	  this.href = null;
	}

	// Reference: RFC 3986, RFC 1808, RFC 2396

	// define these here so at least they only have to be
	// compiled once on the first module load.
	var protocolPattern = /^([a-z0-9.+-]+:)/i,
	    portPattern = /:[0-9]*$/,

	    // RFC 2396: characters reserved for delimiting URLs.
	    // We actually just auto-escape these.
	    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

	    // RFC 2396: characters not allowed for various reasons.
	    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

	    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
	    autoEscape = ['\''].concat(unwise),
	    // Characters that are never ever allowed in a hostname.
	    // Note that any invalid chars are also handled, but these
	    // are the ones that are *expected* to be seen, so we fast-path
	    // them.
	    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
	    hostEndingChars = ['/', '?', '#'],
	    hostnameMaxLen = 255,
	    hostnamePartPattern = /^[a-z0-9A-Z_-]{0,63}$/,
	    hostnamePartStart = /^([a-z0-9A-Z_-]{0,63})(.*)$/,
	    // protocols that can allow "unsafe" and "unwise" chars.
	    unsafeProtocol = {
	      'javascript': true,
	      'javascript:': true
	    },
	    // protocols that never have a hostname.
	    hostlessProtocol = {
	      'javascript': true,
	      'javascript:': true
	    },
	    // protocols that always contain a // bit.
	    slashedProtocol = {
	      'http': true,
	      'https': true,
	      'ftp': true,
	      'gopher': true,
	      'file': true,
	      'http:': true,
	      'https:': true,
	      'ftp:': true,
	      'gopher:': true,
	      'file:': true
	    },
	    querystring = __webpack_require__(11);

	function urlParse(url, parseQueryString, slashesDenoteHost) {
	  if (url && isObject(url) && url instanceof Url) return url;

	  var u = new Url;
	  u.parse(url, parseQueryString, slashesDenoteHost);
	  return u;
	}

	Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
	  if (!isString(url)) {
	    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
	  }

	  var rest = url;

	  // trim before proceeding.
	  // This is to support parse stuff like "  http://foo.com  \n"
	  rest = rest.trim();

	  var proto = protocolPattern.exec(rest);
	  if (proto) {
	    proto = proto[0];
	    var lowerProto = proto.toLowerCase();
	    this.protocol = lowerProto;
	    rest = rest.substr(proto.length);
	  }

	  // figure out if it's got a host
	  // user@server is *always* interpreted as a hostname, and url
	  // resolution will treat //foo/bar as host=foo,path=bar because that's
	  // how the browser resolves relative URLs.
	  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
	    var slashes = rest.substr(0, 2) === '//';
	    if (slashes && !(proto && hostlessProtocol[proto])) {
	      rest = rest.substr(2);
	      this.slashes = true;
	    }
	  }

	  if (!hostlessProtocol[proto] &&
	      (slashes || (proto && !slashedProtocol[proto]))) {

	    // there's a hostname.
	    // the first instance of /, ?, ;, or # ends the host.
	    //
	    // If there is an @ in the hostname, then non-host chars *are* allowed
	    // to the left of the last @ sign, unless some host-ending character
	    // comes *before* the @-sign.
	    // URLs are obnoxious.
	    //
	    // ex:
	    // http://a@b@c/ => user:a@b host:c
	    // http://a@b?@c => user:a host:c path:/?@c

	    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
	    // Review our test case against browsers more comprehensively.

	    // find the first instance of any hostEndingChars
	    var hostEnd = -1;
	    for (var i = 0; i < hostEndingChars.length; i++) {
	      var hec = rest.indexOf(hostEndingChars[i]);
	      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
	        hostEnd = hec;
	    }

	    // at this point, either we have an explicit point where the
	    // auth portion cannot go past, or the last @ char is the decider.
	    var auth, atSign;
	    if (hostEnd === -1) {
	      // atSign can be anywhere.
	      atSign = rest.lastIndexOf('@');
	    } else {
	      // atSign must be in auth portion.
	      // http://a@b/c@d => host:b auth:a path:/c@d
	      atSign = rest.lastIndexOf('@', hostEnd);
	    }

	    // Now we have a portion which is definitely the auth.
	    // Pull that off.
	    if (atSign !== -1) {
	      auth = rest.slice(0, atSign);
	      rest = rest.slice(atSign + 1);
	      this.auth = decodeURIComponent(auth);
	    }

	    // the host is the remaining to the left of the first non-host char
	    hostEnd = -1;
	    for (var i = 0; i < nonHostChars.length; i++) {
	      var hec = rest.indexOf(nonHostChars[i]);
	      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
	        hostEnd = hec;
	    }
	    // if we still have not hit it, then the entire thing is a host.
	    if (hostEnd === -1)
	      hostEnd = rest.length;

	    this.host = rest.slice(0, hostEnd);
	    rest = rest.slice(hostEnd);

	    // pull out port.
	    this.parseHost();

	    // we've indicated that there is a hostname,
	    // so even if it's empty, it has to be present.
	    this.hostname = this.hostname || '';

	    // if hostname begins with [ and ends with ]
	    // assume that it's an IPv6 address.
	    var ipv6Hostname = this.hostname[0] === '[' &&
	        this.hostname[this.hostname.length - 1] === ']';

	    // validate a little.
	    if (!ipv6Hostname) {
	      var hostparts = this.hostname.split(/\./);
	      for (var i = 0, l = hostparts.length; i < l; i++) {
	        var part = hostparts[i];
	        if (!part) continue;
	        if (!part.match(hostnamePartPattern)) {
	          var newpart = '';
	          for (var j = 0, k = part.length; j < k; j++) {
	            if (part.charCodeAt(j) > 127) {
	              // we replace non-ASCII char with a temporary placeholder
	              // we need this to make sure size of hostname is not
	              // broken by replacing non-ASCII by nothing
	              newpart += 'x';
	            } else {
	              newpart += part[j];
	            }
	          }
	          // we test again with ASCII char only
	          if (!newpart.match(hostnamePartPattern)) {
	            var validParts = hostparts.slice(0, i);
	            var notHost = hostparts.slice(i + 1);
	            var bit = part.match(hostnamePartStart);
	            if (bit) {
	              validParts.push(bit[1]);
	              notHost.unshift(bit[2]);
	            }
	            if (notHost.length) {
	              rest = '/' + notHost.join('.') + rest;
	            }
	            this.hostname = validParts.join('.');
	            break;
	          }
	        }
	      }
	    }

	    if (this.hostname.length > hostnameMaxLen) {
	      this.hostname = '';
	    } else {
	      // hostnames are always lower case.
	      this.hostname = this.hostname.toLowerCase();
	    }

	    if (!ipv6Hostname) {
	      // IDNA Support: Returns a puny coded representation of "domain".
	      // It only converts the part of the domain name that
	      // has non ASCII characters. I.e. it dosent matter if
	      // you call it with a domain that already is in ASCII.
	      var domainArray = this.hostname.split('.');
	      var newOut = [];
	      for (var i = 0; i < domainArray.length; ++i) {
	        var s = domainArray[i];
	        newOut.push(s.match(/[^A-Za-z0-9_-]/) ?
	            'xn--' + punycode.encode(s) : s);
	      }
	      this.hostname = newOut.join('.');
	    }

	    var p = this.port ? ':' + this.port : '';
	    var h = this.hostname || '';
	    this.host = h + p;
	    this.href += this.host;

	    // strip [ and ] from the hostname
	    // the host field still retains them, though
	    if (ipv6Hostname) {
	      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
	      if (rest[0] !== '/') {
	        rest = '/' + rest;
	      }
	    }
	  }

	  // now rest is set to the post-host stuff.
	  // chop off any delim chars.
	  if (!unsafeProtocol[lowerProto]) {

	    // First, make 100% sure that any "autoEscape" chars get
	    // escaped, even if encodeURIComponent doesn't think they
	    // need to be.
	    for (var i = 0, l = autoEscape.length; i < l; i++) {
	      var ae = autoEscape[i];
	      var esc = encodeURIComponent(ae);
	      if (esc === ae) {
	        esc = escape(ae);
	      }
	      rest = rest.split(ae).join(esc);
	    }
	  }


	  // chop off from the tail first.
	  var hash = rest.indexOf('#');
	  if (hash !== -1) {
	    // got a fragment string.
	    this.hash = rest.substr(hash);
	    rest = rest.slice(0, hash);
	  }
	  var qm = rest.indexOf('?');
	  if (qm !== -1) {
	    this.search = rest.substr(qm);
	    this.query = rest.substr(qm + 1);
	    if (parseQueryString) {
	      this.query = querystring.parse(this.query);
	    }
	    rest = rest.slice(0, qm);
	  } else if (parseQueryString) {
	    // no query string, but parseQueryString still requested
	    this.search = '';
	    this.query = {};
	  }
	  if (rest) this.pathname = rest;
	  if (slashedProtocol[lowerProto] &&
	      this.hostname && !this.pathname) {
	    this.pathname = '/';
	  }

	  //to support http.request
	  if (this.pathname || this.search) {
	    var p = this.pathname || '';
	    var s = this.search || '';
	    this.path = p + s;
	  }

	  // finally, reconstruct the href based on what has been validated.
	  this.href = this.format();
	  return this;
	};

	// format a parsed object into a url string
	function urlFormat(obj) {
	  // ensure it's an object, and not a string url.
	  // If it's an obj, this is a no-op.
	  // this way, you can call url_format() on strings
	  // to clean up potentially wonky urls.
	  if (isString(obj)) obj = urlParse(obj);
	  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
	  return obj.format();
	}

	Url.prototype.format = function() {
	  var auth = this.auth || '';
	  if (auth) {
	    auth = encodeURIComponent(auth);
	    auth = auth.replace(/%3A/i, ':');
	    auth += '@';
	  }

	  var protocol = this.protocol || '',
	      pathname = this.pathname || '',
	      hash = this.hash || '',
	      host = false,
	      query = '';

	  if (this.host) {
	    host = auth + this.host;
	  } else if (this.hostname) {
	    host = auth + (this.hostname.indexOf(':') === -1 ?
	        this.hostname :
	        '[' + this.hostname + ']');
	    if (this.port) {
	      host += ':' + this.port;
	    }
	  }

	  if (this.query &&
	      isObject(this.query) &&
	      Object.keys(this.query).length) {
	    query = querystring.stringify(this.query);
	  }

	  var search = this.search || (query && ('?' + query)) || '';

	  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

	  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
	  // unless they had them to begin with.
	  if (this.slashes ||
	      (!protocol || slashedProtocol[protocol]) && host !== false) {
	    host = '//' + (host || '');
	    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
	  } else if (!host) {
	    host = '';
	  }

	  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
	  if (search && search.charAt(0) !== '?') search = '?' + search;

	  pathname = pathname.replace(/[?#]/g, function(match) {
	    return encodeURIComponent(match);
	  });
	  search = search.replace('#', '%23');

	  return protocol + host + pathname + search + hash;
	};

	function urlResolve(source, relative) {
	  return urlParse(source, false, true).resolve(relative);
	}

	Url.prototype.resolve = function(relative) {
	  return this.resolveObject(urlParse(relative, false, true)).format();
	};

	function urlResolveObject(source, relative) {
	  if (!source) return relative;
	  return urlParse(source, false, true).resolveObject(relative);
	}

	Url.prototype.resolveObject = function(relative) {
	  if (isString(relative)) {
	    var rel = new Url();
	    rel.parse(relative, false, true);
	    relative = rel;
	  }

	  var result = new Url();
	  Object.keys(this).forEach(function(k) {
	    result[k] = this[k];
	  }, this);

	  // hash is always overridden, no matter what.
	  // even href="" will remove it.
	  result.hash = relative.hash;

	  // if the relative url is empty, then there's nothing left to do here.
	  if (relative.href === '') {
	    result.href = result.format();
	    return result;
	  }

	  // hrefs like //foo/bar always cut to the protocol.
	  if (relative.slashes && !relative.protocol) {
	    // take everything except the protocol from relative
	    Object.keys(relative).forEach(function(k) {
	      if (k !== 'protocol')
	        result[k] = relative[k];
	    });

	    //urlParse appends trailing / to urls like http://www.example.com
	    if (slashedProtocol[result.protocol] &&
	        result.hostname && !result.pathname) {
	      result.path = result.pathname = '/';
	    }

	    result.href = result.format();
	    return result;
	  }

	  if (relative.protocol && relative.protocol !== result.protocol) {
	    // if it's a known url protocol, then changing
	    // the protocol does weird things
	    // first, if it's not file:, then we MUST have a host,
	    // and if there was a path
	    // to begin with, then we MUST have a path.
	    // if it is file:, then the host is dropped,
	    // because that's known to be hostless.
	    // anything else is assumed to be absolute.
	    if (!slashedProtocol[relative.protocol]) {
	      Object.keys(relative).forEach(function(k) {
	        result[k] = relative[k];
	      });
	      result.href = result.format();
	      return result;
	    }

	    result.protocol = relative.protocol;
	    if (!relative.host && !hostlessProtocol[relative.protocol]) {
	      var relPath = (relative.pathname || '').split('/');
	      while (relPath.length && !(relative.host = relPath.shift()));
	      if (!relative.host) relative.host = '';
	      if (!relative.hostname) relative.hostname = '';
	      if (relPath[0] !== '') relPath.unshift('');
	      if (relPath.length < 2) relPath.unshift('');
	      result.pathname = relPath.join('/');
	    } else {
	      result.pathname = relative.pathname;
	    }
	    result.search = relative.search;
	    result.query = relative.query;
	    result.host = relative.host || '';
	    result.auth = relative.auth;
	    result.hostname = relative.hostname || relative.host;
	    result.port = relative.port;
	    // to support http.request
	    if (result.pathname || result.search) {
	      var p = result.pathname || '';
	      var s = result.search || '';
	      result.path = p + s;
	    }
	    result.slashes = result.slashes || relative.slashes;
	    result.href = result.format();
	    return result;
	  }

	  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
	      isRelAbs = (
	          relative.host ||
	          relative.pathname && relative.pathname.charAt(0) === '/'
	      ),
	      mustEndAbs = (isRelAbs || isSourceAbs ||
	                    (result.host && relative.pathname)),
	      removeAllDots = mustEndAbs,
	      srcPath = result.pathname && result.pathname.split('/') || [],
	      relPath = relative.pathname && relative.pathname.split('/') || [],
	      psychotic = result.protocol && !slashedProtocol[result.protocol];

	  // if the url is a non-slashed url, then relative
	  // links like ../.. should be able
	  // to crawl up to the hostname, as well.  This is strange.
	  // result.protocol has already been set by now.
	  // Later on, put the first path part into the host field.
	  if (psychotic) {
	    result.hostname = '';
	    result.port = null;
	    if (result.host) {
	      if (srcPath[0] === '') srcPath[0] = result.host;
	      else srcPath.unshift(result.host);
	    }
	    result.host = '';
	    if (relative.protocol) {
	      relative.hostname = null;
	      relative.port = null;
	      if (relative.host) {
	        if (relPath[0] === '') relPath[0] = relative.host;
	        else relPath.unshift(relative.host);
	      }
	      relative.host = null;
	    }
	    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
	  }

	  if (isRelAbs) {
	    // it's absolute.
	    result.host = (relative.host || relative.host === '') ?
	                  relative.host : result.host;
	    result.hostname = (relative.hostname || relative.hostname === '') ?
	                      relative.hostname : result.hostname;
	    result.search = relative.search;
	    result.query = relative.query;
	    srcPath = relPath;
	    // fall through to the dot-handling below.
	  } else if (relPath.length) {
	    // it's relative
	    // throw away the existing file, and take the new path instead.
	    if (!srcPath) srcPath = [];
	    srcPath.pop();
	    srcPath = srcPath.concat(relPath);
	    result.search = relative.search;
	    result.query = relative.query;
	  } else if (!isNullOrUndefined(relative.search)) {
	    // just pull out the search.
	    // like href='?foo'.
	    // Put this after the other two cases because it simplifies the booleans
	    if (psychotic) {
	      result.hostname = result.host = srcPath.shift();
	      //occationaly the auth can get stuck only in host
	      //this especialy happens in cases like
	      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
	      var authInHost = result.host && result.host.indexOf('@') > 0 ?
	                       result.host.split('@') : false;
	      if (authInHost) {
	        result.auth = authInHost.shift();
	        result.host = result.hostname = authInHost.shift();
	      }
	    }
	    result.search = relative.search;
	    result.query = relative.query;
	    //to support http.request
	    if (!isNull(result.pathname) || !isNull(result.search)) {
	      result.path = (result.pathname ? result.pathname : '') +
	                    (result.search ? result.search : '');
	    }
	    result.href = result.format();
	    return result;
	  }

	  if (!srcPath.length) {
	    // no path at all.  easy.
	    // we've already handled the other stuff above.
	    result.pathname = null;
	    //to support http.request
	    if (result.search) {
	      result.path = '/' + result.search;
	    } else {
	      result.path = null;
	    }
	    result.href = result.format();
	    return result;
	  }

	  // if a url ENDs in . or .., then it must get a trailing slash.
	  // however, if it ends in anything else non-slashy,
	  // then it must NOT get a trailing slash.
	  var last = srcPath.slice(-1)[0];
	  var hasTrailingSlash = (
	      (result.host || relative.host) && (last === '.' || last === '..') ||
	      last === '');

	  // strip single dots, resolve double dots to parent dir
	  // if the path tries to go above the root, `up` ends up > 0
	  var up = 0;
	  for (var i = srcPath.length; i >= 0; i--) {
	    last = srcPath[i];
	    if (last == '.') {
	      srcPath.splice(i, 1);
	    } else if (last === '..') {
	      srcPath.splice(i, 1);
	      up++;
	    } else if (up) {
	      srcPath.splice(i, 1);
	      up--;
	    }
	  }

	  // if the path is allowed to go above the root, restore leading ..s
	  if (!mustEndAbs && !removeAllDots) {
	    for (; up--; up) {
	      srcPath.unshift('..');
	    }
	  }

	  if (mustEndAbs && srcPath[0] !== '' &&
	      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
	    srcPath.unshift('');
	  }

	  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
	    srcPath.push('');
	  }

	  var isAbsolute = srcPath[0] === '' ||
	      (srcPath[0] && srcPath[0].charAt(0) === '/');

	  // put the host back
	  if (psychotic) {
	    result.hostname = result.host = isAbsolute ? '' :
	                                    srcPath.length ? srcPath.shift() : '';
	    //occationaly the auth can get stuck only in host
	    //this especialy happens in cases like
	    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
	    var authInHost = result.host && result.host.indexOf('@') > 0 ?
	                     result.host.split('@') : false;
	    if (authInHost) {
	      result.auth = authInHost.shift();
	      result.host = result.hostname = authInHost.shift();
	    }
	  }

	  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

	  if (mustEndAbs && !isAbsolute) {
	    srcPath.unshift('');
	  }

	  if (!srcPath.length) {
	    result.pathname = null;
	    result.path = null;
	  } else {
	    result.pathname = srcPath.join('/');
	  }

	  //to support request.http
	  if (!isNull(result.pathname) || !isNull(result.search)) {
	    result.path = (result.pathname ? result.pathname : '') +
	                  (result.search ? result.search : '');
	  }
	  result.auth = relative.auth || result.auth;
	  result.slashes = result.slashes || relative.slashes;
	  result.href = result.format();
	  return result;
	};

	Url.prototype.parseHost = function() {
	  var host = this.host;
	  var port = portPattern.exec(host);
	  if (port) {
	    port = port[0];
	    if (port !== ':') {
	      this.port = port.substr(1);
	    }
	    host = host.substr(0, host.length - port.length);
	  }
	  if (host) this.hostname = host;
	};

	function isString(arg) {
	  return typeof arg === "string";
	}

	function isObject(arg) {
	  return typeof arg === 'object' && arg !== null;
	}

	function isNull(arg) {
	  return arg === null;
	}
	function isNullOrUndefined(arg) {
	  return  arg == null;
	}


/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	'use strict';

	exports.decode = exports.parse = __webpack_require__(13);
	exports.encode = exports.stringify = __webpack_require__(14);


/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * Module dependencies.
	 */

	var Emitter = __webpack_require__(18);
	var reduce = __webpack_require__(17);

	/**
	 * Root reference for iframes.
	 */

	var root = 'undefined' == typeof window
	  ? this
	  : window;

	/**
	 * Noop.
	 */

	function noop(){};

	/**
	 * Check if `obj` is a host object,
	 * we don't want to serialize these :)
	 *
	 * TODO: future proof, move to compoent land
	 *
	 * @param {Object} obj
	 * @return {Boolean}
	 * @api private
	 */

	function isHost(obj) {
	  var str = {}.toString.call(obj);

	  switch (str) {
	    case '[object File]':
	    case '[object Blob]':
	    case '[object FormData]':
	      return true;
	    default:
	      return false;
	  }
	}

	/**
	 * Determine XHR.
	 */

	function getXHR() {
	  if (root.XMLHttpRequest
	    && ('file:' != root.location.protocol || !root.ActiveXObject)) {
	    return new XMLHttpRequest;
	  } else {
	    try { return new ActiveXObject('Microsoft.XMLHTTP'); } catch(e) {}
	    try { return new ActiveXObject('Msxml2.XMLHTTP.6.0'); } catch(e) {}
	    try { return new ActiveXObject('Msxml2.XMLHTTP.3.0'); } catch(e) {}
	    try { return new ActiveXObject('Msxml2.XMLHTTP'); } catch(e) {}
	  }
	  return false;
	}

	/**
	 * Removes leading and trailing whitespace, added to support IE.
	 *
	 * @param {String} s
	 * @return {String}
	 * @api private
	 */

	var trim = ''.trim
	  ? function(s) { return s.trim(); }
	  : function(s) { return s.replace(/(^\s*|\s*$)/g, ''); };

	/**
	 * Check if `obj` is an object.
	 *
	 * @param {Object} obj
	 * @return {Boolean}
	 * @api private
	 */

	function isObject(obj) {
	  return obj === Object(obj);
	}

	/**
	 * Serialize the given `obj`.
	 *
	 * @param {Object} obj
	 * @return {String}
	 * @api private
	 */

	function serialize(obj) {
	  if (!isObject(obj)) return obj;
	  var pairs = [];
	  for (var key in obj) {
	    if (null != obj[key]) {
	      pairs.push(encodeURIComponent(key)
	        + '=' + encodeURIComponent(obj[key]));
	    }
	  }
	  return pairs.join('&');
	}

	/**
	 * Expose serialization method.
	 */

	 request.serializeObject = serialize;

	 /**
	  * Parse the given x-www-form-urlencoded `str`.
	  *
	  * @param {String} str
	  * @return {Object}
	  * @api private
	  */

	function parseString(str) {
	  var obj = {};
	  var pairs = str.split('&');
	  var parts;
	  var pair;

	  for (var i = 0, len = pairs.length; i < len; ++i) {
	    pair = pairs[i];
	    parts = pair.split('=');
	    obj[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
	  }

	  return obj;
	}

	/**
	 * Expose parser.
	 */

	request.parseString = parseString;

	/**
	 * Default MIME type map.
	 *
	 *     superagent.types.xml = 'application/xml';
	 *
	 */

	request.types = {
	  html: 'text/html',
	  json: 'application/json',
	  xml: 'application/xml',
	  urlencoded: 'application/x-www-form-urlencoded',
	  'form': 'application/x-www-form-urlencoded',
	  'form-data': 'application/x-www-form-urlencoded'
	};

	/**
	 * Default serialization map.
	 *
	 *     superagent.serialize['application/xml'] = function(obj){
	 *       return 'generated xml here';
	 *     };
	 *
	 */

	 request.serialize = {
	   'application/x-www-form-urlencoded': serialize,
	   'application/json': JSON.stringify
	 };

	 /**
	  * Default parsers.
	  *
	  *     superagent.parse['application/xml'] = function(str){
	  *       return { object parsed from str };
	  *     };
	  *
	  */

	request.parse = {
	  'application/x-www-form-urlencoded': parseString,
	  'application/json': JSON.parse
	};

	/**
	 * Parse the given header `str` into
	 * an object containing the mapped fields.
	 *
	 * @param {String} str
	 * @return {Object}
	 * @api private
	 */

	function parseHeader(str) {
	  var lines = str.split(/\r?\n/);
	  var fields = {};
	  var index;
	  var line;
	  var field;
	  var val;

	  lines.pop(); // trailing CRLF

	  for (var i = 0, len = lines.length; i < len; ++i) {
	    line = lines[i];
	    index = line.indexOf(':');
	    field = line.slice(0, index).toLowerCase();
	    val = trim(line.slice(index + 1));
	    fields[field] = val;
	  }

	  return fields;
	}

	/**
	 * Return the mime type for the given `str`.
	 *
	 * @param {String} str
	 * @return {String}
	 * @api private
	 */

	function type(str){
	  return str.split(/ *; */).shift();
	};

	/**
	 * Return header field parameters.
	 *
	 * @param {String} str
	 * @return {Object}
	 * @api private
	 */

	function params(str){
	  return reduce(str.split(/ *; */), function(obj, str){
	    var parts = str.split(/ *= */)
	      , key = parts.shift()
	      , val = parts.shift();

	    if (key && val) obj[key] = val;
	    return obj;
	  }, {});
	};

	/**
	 * Initialize a new `Response` with the given `xhr`.
	 *
	 *  - set flags (.ok, .error, etc)
	 *  - parse header
	 *
	 * Examples:
	 *
	 *  Aliasing `superagent` as `request` is nice:
	 *
	 *      request = superagent;
	 *
	 *  We can use the promise-like API, or pass callbacks:
	 *
	 *      request.get('/').end(function(res){});
	 *      request.get('/', function(res){});
	 *
	 *  Sending data can be chained:
	 *
	 *      request
	 *        .post('/user')
	 *        .send({ name: 'tj' })
	 *        .end(function(res){});
	 *
	 *  Or passed to `.send()`:
	 *
	 *      request
	 *        .post('/user')
	 *        .send({ name: 'tj' }, function(res){});
	 *
	 *  Or passed to `.post()`:
	 *
	 *      request
	 *        .post('/user', { name: 'tj' })
	 *        .end(function(res){});
	 *
	 * Or further reduced to a single call for simple cases:
	 *
	 *      request
	 *        .post('/user', { name: 'tj' }, function(res){});
	 *
	 * @param {XMLHTTPRequest} xhr
	 * @param {Object} options
	 * @api private
	 */

	function Response(req, options) {
	  options = options || {};
	  this.req = req;
	  this.xhr = this.req.xhr;
	  this.text = this.req.method !='HEAD' 
	     ? this.xhr.responseText 
	     : null;
	  this.setStatusProperties(this.xhr.status);
	  this.header = this.headers = parseHeader(this.xhr.getAllResponseHeaders());
	  // getAllResponseHeaders sometimes falsely returns "" for CORS requests, but
	  // getResponseHeader still works. so we get content-type even if getting
	  // other headers fails.
	  this.header['content-type'] = this.xhr.getResponseHeader('content-type');
	  this.setHeaderProperties(this.header);
	  this.body = this.req.method != 'HEAD'
	    ? this.parseBody(this.text)
	    : null;
	}

	/**
	 * Get case-insensitive `field` value.
	 *
	 * @param {String} field
	 * @return {String}
	 * @api public
	 */

	Response.prototype.get = function(field){
	  return this.header[field.toLowerCase()];
	};

	/**
	 * Set header related properties:
	 *
	 *   - `.type` the content type without params
	 *
	 * A response of "Content-Type: text/plain; charset=utf-8"
	 * will provide you with a `.type` of "text/plain".
	 *
	 * @param {Object} header
	 * @api private
	 */

	Response.prototype.setHeaderProperties = function(header){
	  // content-type
	  var ct = this.header['content-type'] || '';
	  this.type = type(ct);

	  // params
	  var obj = params(ct);
	  for (var key in obj) this[key] = obj[key];
	};

	/**
	 * Parse the given body `str`.
	 *
	 * Used for auto-parsing of bodies. Parsers
	 * are defined on the `superagent.parse` object.
	 *
	 * @param {String} str
	 * @return {Mixed}
	 * @api private
	 */

	Response.prototype.parseBody = function(str){
	  var parse = request.parse[this.type];
	  return parse && str && str.length
	    ? parse(str)
	    : null;
	};

	/**
	 * Set flags such as `.ok` based on `status`.
	 *
	 * For example a 2xx response will give you a `.ok` of __true__
	 * whereas 5xx will be __false__ and `.error` will be __true__. The
	 * `.clientError` and `.serverError` are also available to be more
	 * specific, and `.statusType` is the class of error ranging from 1..5
	 * sometimes useful for mapping respond colors etc.
	 *
	 * "sugar" properties are also defined for common cases. Currently providing:
	 *
	 *   - .noContent
	 *   - .badRequest
	 *   - .unauthorized
	 *   - .notAcceptable
	 *   - .notFound
	 *
	 * @param {Number} status
	 * @api private
	 */

	Response.prototype.setStatusProperties = function(status){
	  var type = status / 100 | 0;

	  // status / class
	  this.status = status;
	  this.statusType = type;

	  // basics
	  this.info = 1 == type;
	  this.ok = 2 == type;
	  this.clientError = 4 == type;
	  this.serverError = 5 == type;
	  this.error = (4 == type || 5 == type)
	    ? this.toError()
	    : false;

	  // sugar
	  this.accepted = 202 == status;
	  this.noContent = 204 == status || 1223 == status;
	  this.badRequest = 400 == status;
	  this.unauthorized = 401 == status;
	  this.notAcceptable = 406 == status;
	  this.notFound = 404 == status;
	  this.forbidden = 403 == status;
	};

	/**
	 * Return an `Error` representative of this response.
	 *
	 * @return {Error}
	 * @api public
	 */

	Response.prototype.toError = function(){
	  var req = this.req;
	  var method = req.method;
	  var url = req.url;

	  var msg = 'cannot ' + method + ' ' + url + ' (' + this.status + ')';
	  var err = new Error(msg);
	  err.status = this.status;
	  err.method = method;
	  err.url = url;

	  return err;
	};

	/**
	 * Expose `Response`.
	 */

	request.Response = Response;

	/**
	 * Initialize a new `Request` with the given `method` and `url`.
	 *
	 * @param {String} method
	 * @param {String} url
	 * @api public
	 */

	function Request(method, url) {
	  var self = this;
	  Emitter.call(this);
	  this._query = this._query || [];
	  this.method = method;
	  this.url = url;
	  this.header = {};
	  this._header = {};
	  this.on('end', function(){
	    var err = null;
	    var res = null;

	    try {
	      res = new Response(self); 
	    } catch(e) {
	      err = new Error('Parser is unable to parse the response');
	      err.parse = true;
	      err.original = e;
	    }

	    self.callback(err, res);
	  });
	}

	/**
	 * Mixin `Emitter`.
	 */

	Emitter(Request.prototype);

	/**
	 * Allow for extension
	 */

	Request.prototype.use = function(fn) {
	  fn(this);
	  return this;
	}

	/**
	 * Set timeout to `ms`.
	 *
	 * @param {Number} ms
	 * @return {Request} for chaining
	 * @api public
	 */

	Request.prototype.timeout = function(ms){
	  this._timeout = ms;
	  return this;
	};

	/**
	 * Clear previous timeout.
	 *
	 * @return {Request} for chaining
	 * @api public
	 */

	Request.prototype.clearTimeout = function(){
	  this._timeout = 0;
	  clearTimeout(this._timer);
	  return this;
	};

	/**
	 * Abort the request, and clear potential timeout.
	 *
	 * @return {Request}
	 * @api public
	 */

	Request.prototype.abort = function(){
	  if (this.aborted) return;
	  this.aborted = true;
	  this.xhr.abort();
	  this.clearTimeout();
	  this.emit('abort');
	  return this;
	};

	/**
	 * Set header `field` to `val`, or multiple fields with one object.
	 *
	 * Examples:
	 *
	 *      req.get('/')
	 *        .set('Accept', 'application/json')
	 *        .set('X-API-Key', 'foobar')
	 *        .end(callback);
	 *
	 *      req.get('/')
	 *        .set({ Accept: 'application/json', 'X-API-Key': 'foobar' })
	 *        .end(callback);
	 *
	 * @param {String|Object} field
	 * @param {String} val
	 * @return {Request} for chaining
	 * @api public
	 */

	Request.prototype.set = function(field, val){
	  if (isObject(field)) {
	    for (var key in field) {
	      this.set(key, field[key]);
	    }
	    return this;
	  }
	  this._header[field.toLowerCase()] = val;
	  this.header[field] = val;
	  return this;
	};

	/**
	 * Remove header `field`.
	 *
	 * Example:
	 *
	 *      req.get('/')
	 *        .unset('User-Agent')
	 *        .end(callback);
	 *
	 * @param {String} field
	 * @return {Request} for chaining
	 * @api public
	 */

	Request.prototype.unset = function(field){
	  delete this._header[field.toLowerCase()];
	  delete this.header[field];
	  return this;
	};

	/**
	 * Get case-insensitive header `field` value.
	 *
	 * @param {String} field
	 * @return {String}
	 * @api private
	 */

	Request.prototype.getHeader = function(field){
	  return this._header[field.toLowerCase()];
	};

	/**
	 * Set Content-Type to `type`, mapping values from `request.types`.
	 *
	 * Examples:
	 *
	 *      superagent.types.xml = 'application/xml';
	 *
	 *      request.post('/')
	 *        .type('xml')
	 *        .send(xmlstring)
	 *        .end(callback);
	 *
	 *      request.post('/')
	 *        .type('application/xml')
	 *        .send(xmlstring)
	 *        .end(callback);
	 *
	 * @param {String} type
	 * @return {Request} for chaining
	 * @api public
	 */

	Request.prototype.type = function(type){
	  this.set('Content-Type', request.types[type] || type);
	  return this;
	};

	/**
	 * Set Accept to `type`, mapping values from `request.types`.
	 *
	 * Examples:
	 *
	 *      superagent.types.json = 'application/json';
	 *
	 *      request.get('/agent')
	 *        .accept('json')
	 *        .end(callback);
	 *
	 *      request.get('/agent')
	 *        .accept('application/json')
	 *        .end(callback);
	 *
	 * @param {String} accept
	 * @return {Request} for chaining
	 * @api public
	 */

	Request.prototype.accept = function(type){
	  this.set('Accept', request.types[type] || type);
	  return this;
	};

	/**
	 * Set Authorization field value with `user` and `pass`.
	 *
	 * @param {String} user
	 * @param {String} pass
	 * @return {Request} for chaining
	 * @api public
	 */

	Request.prototype.auth = function(user, pass){
	  var str = btoa(user + ':' + pass);
	  this.set('Authorization', 'Basic ' + str);
	  return this;
	};

	/**
	* Add query-string `val`.
	*
	* Examples:
	*
	*   request.get('/shoes')
	*     .query('size=10')
	*     .query({ color: 'blue' })
	*
	* @param {Object|String} val
	* @return {Request} for chaining
	* @api public
	*/

	Request.prototype.query = function(val){
	  if ('string' != typeof val) val = serialize(val);
	  if (val) this._query.push(val);
	  return this;
	};

	/**
	 * Write the field `name` and `val` for "multipart/form-data"
	 * request bodies.
	 *
	 * ``` js
	 * request.post('/upload')
	 *   .field('foo', 'bar')
	 *   .end(callback);
	 * ```
	 *
	 * @param {String} name
	 * @param {String|Blob|File} val
	 * @return {Request} for chaining
	 * @api public
	 */

	Request.prototype.field = function(name, val){
	  if (!this._formData) this._formData = new FormData();
	  this._formData.append(name, val);
	  return this;
	};

	/**
	 * Queue the given `file` as an attachment to the specified `field`,
	 * with optional `filename`.
	 *
	 * ``` js
	 * request.post('/upload')
	 *   .attach(new Blob(['<a id="a"><b id="b">hey!</b></a>'], { type: "text/html"}))
	 *   .end(callback);
	 * ```
	 *
	 * @param {String} field
	 * @param {Blob|File} file
	 * @param {String} filename
	 * @return {Request} for chaining
	 * @api public
	 */

	Request.prototype.attach = function(field, file, filename){
	  if (!this._formData) this._formData = new FormData();
	  this._formData.append(field, file, filename);
	  return this;
	};

	/**
	 * Send `data`, defaulting the `.type()` to "json" when
	 * an object is given.
	 *
	 * Examples:
	 *
	 *       // querystring
	 *       request.get('/search')
	 *         .end(callback)
	 *
	 *       // multiple data "writes"
	 *       request.get('/search')
	 *         .send({ search: 'query' })
	 *         .send({ range: '1..5' })
	 *         .send({ order: 'desc' })
	 *         .end(callback)
	 *
	 *       // manual json
	 *       request.post('/user')
	 *         .type('json')
	 *         .send('{"name":"tj"})
	 *         .end(callback)
	 *
	 *       // auto json
	 *       request.post('/user')
	 *         .send({ name: 'tj' })
	 *         .end(callback)
	 *
	 *       // manual x-www-form-urlencoded
	 *       request.post('/user')
	 *         .type('form')
	 *         .send('name=tj')
	 *         .end(callback)
	 *
	 *       // auto x-www-form-urlencoded
	 *       request.post('/user')
	 *         .type('form')
	 *         .send({ name: 'tj' })
	 *         .end(callback)
	 *
	 *       // defaults to x-www-form-urlencoded
	  *      request.post('/user')
	  *        .send('name=tobi')
	  *        .send('species=ferret')
	  *        .end(callback)
	 *
	 * @param {String|Object} data
	 * @return {Request} for chaining
	 * @api public
	 */

	Request.prototype.send = function(data){
	  var obj = isObject(data);
	  var type = this.getHeader('Content-Type');

	  // merge
	  if (obj && isObject(this._data)) {
	    for (var key in data) {
	      this._data[key] = data[key];
	    }
	  } else if ('string' == typeof data) {
	    if (!type) this.type('form');
	    type = this.getHeader('Content-Type');
	    if ('application/x-www-form-urlencoded' == type) {
	      this._data = this._data
	        ? this._data + '&' + data
	        : data;
	    } else {
	      this._data = (this._data || '') + data;
	    }
	  } else {
	    this._data = data;
	  }

	  if (!obj) return this;
	  if (!type) this.type('json');
	  return this;
	};

	/**
	 * Invoke the callback with `err` and `res`
	 * and handle arity check.
	 *
	 * @param {Error} err
	 * @param {Response} res
	 * @api private
	 */

	Request.prototype.callback = function(err, res){
	  var fn = this._callback;
	  this.clearTimeout();
	  if (2 == fn.length) return fn(err, res);
	  if (err) return this.emit('error', err);
	  fn(res);
	};

	/**
	 * Invoke callback with x-domain error.
	 *
	 * @api private
	 */

	Request.prototype.crossDomainError = function(){
	  var err = new Error('Origin is not allowed by Access-Control-Allow-Origin');
	  err.crossDomain = true;
	  this.callback(err);
	};

	/**
	 * Invoke callback with timeout error.
	 *
	 * @api private
	 */

	Request.prototype.timeoutError = function(){
	  var timeout = this._timeout;
	  var err = new Error('timeout of ' + timeout + 'ms exceeded');
	  err.timeout = timeout;
	  this.callback(err);
	};

	/**
	 * Enable transmission of cookies with x-domain requests.
	 *
	 * Note that for this to work the origin must not be
	 * using "Access-Control-Allow-Origin" with a wildcard,
	 * and also must set "Access-Control-Allow-Credentials"
	 * to "true".
	 *
	 * @api public
	 */

	Request.prototype.withCredentials = function(){
	  this._withCredentials = true;
	  return this;
	};

	/**
	 * Initiate request, invoking callback `fn(res)`
	 * with an instanceof `Response`.
	 *
	 * @param {Function} fn
	 * @return {Request} for chaining
	 * @api public
	 */

	Request.prototype.end = function(fn){
	  var self = this;
	  var xhr = this.xhr = getXHR();
	  var query = this._query.join('&');
	  var timeout = this._timeout;
	  var data = this._formData || this._data;

	  // store callback
	  this._callback = fn || noop;

	  // state change
	  xhr.onreadystatechange = function(){
	    if (4 != xhr.readyState) return;
	    if (0 == xhr.status) {
	      if (self.aborted) return self.timeoutError();
	      return self.crossDomainError();
	    }
	    self.emit('end');
	  };

	  // progress
	  if (xhr.upload) {
	    xhr.upload.onprogress = function(e){
	      e.percent = e.loaded / e.total * 100;
	      self.emit('progress', e);
	    };
	  }

	  // timeout
	  if (timeout && !this._timer) {
	    this._timer = setTimeout(function(){
	      self.abort();
	    }, timeout);
	  }

	  // querystring
	  if (query) {
	    query = request.serializeObject(query);
	    this.url += ~this.url.indexOf('?')
	      ? '&' + query
	      : '?' + query;
	  }

	  // initiate request
	  xhr.open(this.method, this.url, true);

	  // CORS
	  if (this._withCredentials) xhr.withCredentials = true;

	  // body
	  if ('GET' != this.method && 'HEAD' != this.method && 'string' != typeof data && !isHost(data)) {
	    // serialize stuff
	    var serialize = request.serialize[this.getHeader('Content-Type')];
	    if (serialize) data = serialize(data);
	  }

	  // set header fields
	  for (var field in this.header) {
	    if (null == this.header[field]) continue;
	    xhr.setRequestHeader(field, this.header[field]);
	  }

	  // send stuff
	  this.emit('request', this);
	  xhr.send(data);
	  return this;
	};

	/**
	 * Expose `Request`.
	 */

	request.Request = Request;

	/**
	 * Issue a request:
	 *
	 * Examples:
	 *
	 *    request('GET', '/users').end(callback)
	 *    request('/users').end(callback)
	 *    request('/users', callback)
	 *
	 * @param {String} method
	 * @param {String|Function} url or callback
	 * @return {Request}
	 * @api public
	 */

	function request(method, url) {
	  // callback
	  if ('function' == typeof url) {
	    return new Request('GET', method).end(url);
	  }

	  // url first
	  if (1 == arguments.length) {
	    return new Request('GET', method);
	  }

	  return new Request(method, url);
	}

	/**
	 * GET `url` with optional callback `fn(res)`.
	 *
	 * @param {String} url
	 * @param {Mixed|Function} data or fn
	 * @param {Function} fn
	 * @return {Request}
	 * @api public
	 */

	request.get = function(url, data, fn){
	  var req = request('GET', url);
	  if ('function' == typeof data) fn = data, data = null;
	  if (data) req.query(data);
	  if (fn) req.end(fn);
	  return req;
	};

	/**
	 * HEAD `url` with optional callback `fn(res)`.
	 *
	 * @param {String} url
	 * @param {Mixed|Function} data or fn
	 * @param {Function} fn
	 * @return {Request}
	 * @api public
	 */

	request.head = function(url, data, fn){
	  var req = request('HEAD', url);
	  if ('function' == typeof data) fn = data, data = null;
	  if (data) req.send(data);
	  if (fn) req.end(fn);
	  return req;
	};

	/**
	 * DELETE `url` with optional callback `fn(res)`.
	 *
	 * @param {String} url
	 * @param {Function} fn
	 * @return {Request}
	 * @api public
	 */

	request.del = function(url, fn){
	  var req = request('DELETE', url);
	  if (fn) req.end(fn);
	  return req;
	};

	/**
	 * PATCH `url` with optional `data` and callback `fn(res)`.
	 *
	 * @param {String} url
	 * @param {Mixed} data
	 * @param {Function} fn
	 * @return {Request}
	 * @api public
	 */

	request.patch = function(url, data, fn){
	  var req = request('PATCH', url);
	  if ('function' == typeof data) fn = data, data = null;
	  if (data) req.send(data);
	  if (fn) req.end(fn);
	  return req;
	};

	/**
	 * POST `url` with optional `data` and callback `fn(res)`.
	 *
	 * @param {String} url
	 * @param {Mixed} data
	 * @param {Function} fn
	 * @return {Request}
	 * @api public
	 */

	request.post = function(url, data, fn){
	  var req = request('POST', url);
	  if ('function' == typeof data) fn = data, data = null;
	  if (data) req.send(data);
	  if (fn) req.end(fn);
	  return req;
	};

	/**
	 * PUT `url` with optional `data` and callback `fn(res)`.
	 *
	 * @param {String} url
	 * @param {Mixed|Function} data or fn
	 * @param {Function} fn
	 * @return {Request}
	 * @api public
	 */

	request.put = function(url, data, fn){
	  var req = request('PUT', url);
	  if ('function' == typeof data) fn = data, data = null;
	  if (data) req.send(data);
	  if (fn) req.end(fn);
	  return req;
	};

	/**
	 * Expose `request`.
	 */

	module.exports = request;


/***/ },
/* 13 */
/***/ function(module, exports, __webpack_require__) {

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	'use strict';

	// If obj.hasOwnProperty has been overridden, then calling
	// obj.hasOwnProperty(prop) will break.
	// See: https://github.com/joyent/node/issues/1707
	function hasOwnProperty(obj, prop) {
	  return Object.prototype.hasOwnProperty.call(obj, prop);
	}

	module.exports = function(qs, sep, eq, options) {
	  sep = sep || '&';
	  eq = eq || '=';
	  var obj = {};

	  if (typeof qs !== 'string' || qs.length === 0) {
	    return obj;
	  }

	  var regexp = /\+/g;
	  qs = qs.split(sep);

	  var maxKeys = 1000;
	  if (options && typeof options.maxKeys === 'number') {
	    maxKeys = options.maxKeys;
	  }

	  var len = qs.length;
	  // maxKeys <= 0 means that we should not limit keys count
	  if (maxKeys > 0 && len > maxKeys) {
	    len = maxKeys;
	  }

	  for (var i = 0; i < len; ++i) {
	    var x = qs[i].replace(regexp, '%20'),
	        idx = x.indexOf(eq),
	        kstr, vstr, k, v;

	    if (idx >= 0) {
	      kstr = x.substr(0, idx);
	      vstr = x.substr(idx + 1);
	    } else {
	      kstr = x;
	      vstr = '';
	    }

	    k = decodeURIComponent(kstr);
	    v = decodeURIComponent(vstr);

	    if (!hasOwnProperty(obj, k)) {
	      obj[k] = v;
	    } else if (isArray(obj[k])) {
	      obj[k].push(v);
	    } else {
	      obj[k] = [obj[k], v];
	    }
	  }

	  return obj;
	};

	var isArray = Array.isArray || function (xs) {
	  return Object.prototype.toString.call(xs) === '[object Array]';
	};


/***/ },
/* 14 */
/***/ function(module, exports, __webpack_require__) {

	// Copyright Joyent, Inc. and other Node contributors.
	//
	// Permission is hereby granted, free of charge, to any person obtaining a
	// copy of this software and associated documentation files (the
	// "Software"), to deal in the Software without restriction, including
	// without limitation the rights to use, copy, modify, merge, publish,
	// distribute, sublicense, and/or sell copies of the Software, and to permit
	// persons to whom the Software is furnished to do so, subject to the
	// following conditions:
	//
	// The above copyright notice and this permission notice shall be included
	// in all copies or substantial portions of the Software.
	//
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
	// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
	// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
	// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
	// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
	// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
	// USE OR OTHER DEALINGS IN THE SOFTWARE.

	'use strict';

	var stringifyPrimitive = function(v) {
	  switch (typeof v) {
	    case 'string':
	      return v;

	    case 'boolean':
	      return v ? 'true' : 'false';

	    case 'number':
	      return isFinite(v) ? v : '';

	    default:
	      return '';
	  }
	};

	module.exports = function(obj, sep, eq, name) {
	  sep = sep || '&';
	  eq = eq || '=';
	  if (obj === null) {
	    obj = undefined;
	  }

	  if (typeof obj === 'object') {
	    return map(objectKeys(obj), function(k) {
	      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
	      if (isArray(obj[k])) {
	        return map(obj[k], function(v) {
	          return ks + encodeURIComponent(stringifyPrimitive(v));
	        }).join(sep);
	      } else {
	        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
	      }
	    }).join(sep);

	  }

	  if (!name) return '';
	  return encodeURIComponent(stringifyPrimitive(name)) + eq +
	         encodeURIComponent(stringifyPrimitive(obj));
	};

	var isArray = Array.isArray || function (xs) {
	  return Object.prototype.toString.call(xs) === '[object Array]';
	};

	function map (xs, f) {
	  if (xs.map) return xs.map(f);
	  var res = [];
	  for (var i = 0; i < xs.length; i++) {
	    res.push(f(xs[i], i));
	  }
	  return res;
	}

	var objectKeys = Object.keys || function (obj) {
	  var res = [];
	  for (var key in obj) {
	    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
	  }
	  return res;
	};


/***/ },
/* 15 */
/***/ function(module, exports, __webpack_require__) {

	// shim for using process in browser

	var process = module.exports = {};

	process.nextTick = (function () {
	    var canSetImmediate = typeof window !== 'undefined'
	    && window.setImmediate;
	    var canMutationObserver = typeof window !== 'undefined'
	    && window.MutationObserver;
	    var canPost = typeof window !== 'undefined'
	    && window.postMessage && window.addEventListener
	    ;

	    if (canSetImmediate) {
	        return function (f) { return window.setImmediate(f) };
	    }

	    var queue = [];

	    if (canMutationObserver) {
	        var hiddenDiv = document.createElement("div");
	        var observer = new MutationObserver(function () {
	            var queueList = queue.slice();
	            queue.length = 0;
	            queueList.forEach(function (fn) {
	                fn();
	            });
	        });

	        observer.observe(hiddenDiv, { attributes: true });

	        return function nextTick(fn) {
	            if (!queue.length) {
	                hiddenDiv.setAttribute('yes', 'no');
	            }
	            queue.push(fn);
	        };
	    }

	    if (canPost) {
	        window.addEventListener('message', function (ev) {
	            var source = ev.source;
	            if ((source === window || source === null) && ev.data === 'process-tick') {
	                ev.stopPropagation();
	                if (queue.length > 0) {
	                    var fn = queue.shift();
	                    fn();
	                }
	            }
	        }, true);

	        return function nextTick(fn) {
	            queue.push(fn);
	            window.postMessage('process-tick', '*');
	        };
	    }

	    return function nextTick(fn) {
	        setTimeout(fn, 0);
	    };
	})();

	process.title = 'browser';
	process.browser = true;
	process.env = {};
	process.argv = [];

	function noop() {}

	process.on = noop;
	process.addListener = noop;
	process.once = noop;
	process.off = noop;
	process.removeListener = noop;
	process.removeAllListeners = noop;
	process.emit = noop;

	process.binding = function (name) {
	    throw new Error('process.binding is not supported');
	};

	// TODO(shtylman)
	process.cwd = function () { return '/' };
	process.chdir = function (dir) {
	    throw new Error('process.chdir is not supported');
	};


/***/ },
/* 16 */
/***/ function(module, exports, __webpack_require__) {

	var __WEBPACK_AMD_DEFINE_RESULT__;/* WEBPACK VAR INJECTION */(function(module, global) {/*! https://mths.be/punycode v1.3.2 by @mathias */
	;(function(root) {

		/** Detect free variables */
		var freeExports = typeof exports == 'object' && exports &&
			!exports.nodeType && exports;
		var freeModule = typeof module == 'object' && module &&
			!module.nodeType && module;
		var freeGlobal = typeof global == 'object' && global;
		if (
			freeGlobal.global === freeGlobal ||
			freeGlobal.window === freeGlobal ||
			freeGlobal.self === freeGlobal
		) {
			root = freeGlobal;
		}

		/**
		 * The `punycode` object.
		 * @name punycode
		 * @type Object
		 */
		var punycode,

		/** Highest positive signed 32-bit float value */
		maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

		/** Bootstring parameters */
		base = 36,
		tMin = 1,
		tMax = 26,
		skew = 38,
		damp = 700,
		initialBias = 72,
		initialN = 128, // 0x80
		delimiter = '-', // '\x2D'

		/** Regular expressions */
		regexPunycode = /^xn--/,
		regexNonASCII = /[^\x20-\x7E]/, // unprintable ASCII chars + non-ASCII chars
		regexSeparators = /[\x2E\u3002\uFF0E\uFF61]/g, // RFC 3490 separators

		/** Error messages */
		errors = {
			'overflow': 'Overflow: input needs wider integers to process',
			'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
			'invalid-input': 'Invalid input'
		},

		/** Convenience shortcuts */
		baseMinusTMin = base - tMin,
		floor = Math.floor,
		stringFromCharCode = String.fromCharCode,

		/** Temporary variable */
		key;

		/*--------------------------------------------------------------------------*/

		/**
		 * A generic error utility function.
		 * @private
		 * @param {String} type The error type.
		 * @returns {Error} Throws a `RangeError` with the applicable error message.
		 */
		function error(type) {
			throw RangeError(errors[type]);
		}

		/**
		 * A generic `Array#map` utility function.
		 * @private
		 * @param {Array} array The array to iterate over.
		 * @param {Function} callback The function that gets called for every array
		 * item.
		 * @returns {Array} A new array of values returned by the callback function.
		 */
		function map(array, fn) {
			var length = array.length;
			var result = [];
			while (length--) {
				result[length] = fn(array[length]);
			}
			return result;
		}

		/**
		 * A simple `Array#map`-like wrapper to work with domain name strings or email
		 * addresses.
		 * @private
		 * @param {String} domain The domain name or email address.
		 * @param {Function} callback The function that gets called for every
		 * character.
		 * @returns {Array} A new string of characters returned by the callback
		 * function.
		 */
		function mapDomain(string, fn) {
			var parts = string.split('@');
			var result = '';
			if (parts.length > 1) {
				// In email addresses, only the domain name should be punycoded. Leave
				// the local part (i.e. everything up to `@`) intact.
				result = parts[0] + '@';
				string = parts[1];
			}
			// Avoid `split(regex)` for IE8 compatibility. See #17.
			string = string.replace(regexSeparators, '\x2E');
			var labels = string.split('.');
			var encoded = map(labels, fn).join('.');
			return result + encoded;
		}

		/**
		 * Creates an array containing the numeric code points of each Unicode
		 * character in the string. While JavaScript uses UCS-2 internally,
		 * this function will convert a pair of surrogate halves (each of which
		 * UCS-2 exposes as separate characters) into a single code point,
		 * matching UTF-16.
		 * @see `punycode.ucs2.encode`
		 * @see <https://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode.ucs2
		 * @name decode
		 * @param {String} string The Unicode input string (UCS-2).
		 * @returns {Array} The new array of code points.
		 */
		function ucs2decode(string) {
			var output = [],
			    counter = 0,
			    length = string.length,
			    value,
			    extra;
			while (counter < length) {
				value = string.charCodeAt(counter++);
				if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
					// high surrogate, and there is a next character
					extra = string.charCodeAt(counter++);
					if ((extra & 0xFC00) == 0xDC00) { // low surrogate
						output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
					} else {
						// unmatched surrogate; only append this code unit, in case the next
						// code unit is the high surrogate of a surrogate pair
						output.push(value);
						counter--;
					}
				} else {
					output.push(value);
				}
			}
			return output;
		}

		/**
		 * Creates a string based on an array of numeric code points.
		 * @see `punycode.ucs2.decode`
		 * @memberOf punycode.ucs2
		 * @name encode
		 * @param {Array} codePoints The array of numeric code points.
		 * @returns {String} The new Unicode string (UCS-2).
		 */
		function ucs2encode(array) {
			return map(array, function(value) {
				var output = '';
				if (value > 0xFFFF) {
					value -= 0x10000;
					output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
					value = 0xDC00 | value & 0x3FF;
				}
				output += stringFromCharCode(value);
				return output;
			}).join('');
		}

		/**
		 * Converts a basic code point into a digit/integer.
		 * @see `digitToBasic()`
		 * @private
		 * @param {Number} codePoint The basic numeric code point value.
		 * @returns {Number} The numeric value of a basic code point (for use in
		 * representing integers) in the range `0` to `base - 1`, or `base` if
		 * the code point does not represent a value.
		 */
		function basicToDigit(codePoint) {
			if (codePoint - 48 < 10) {
				return codePoint - 22;
			}
			if (codePoint - 65 < 26) {
				return codePoint - 65;
			}
			if (codePoint - 97 < 26) {
				return codePoint - 97;
			}
			return base;
		}

		/**
		 * Converts a digit/integer into a basic code point.
		 * @see `basicToDigit()`
		 * @private
		 * @param {Number} digit The numeric value of a basic code point.
		 * @returns {Number} The basic code point whose value (when used for
		 * representing integers) is `digit`, which needs to be in the range
		 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
		 * used; else, the lowercase form is used. The behavior is undefined
		 * if `flag` is non-zero and `digit` has no uppercase form.
		 */
		function digitToBasic(digit, flag) {
			//  0..25 map to ASCII a..z or A..Z
			// 26..35 map to ASCII 0..9
			return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
		}

		/**
		 * Bias adaptation function as per section 3.4 of RFC 3492.
		 * http://tools.ietf.org/html/rfc3492#section-3.4
		 * @private
		 */
		function adapt(delta, numPoints, firstTime) {
			var k = 0;
			delta = firstTime ? floor(delta / damp) : delta >> 1;
			delta += floor(delta / numPoints);
			for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
				delta = floor(delta / baseMinusTMin);
			}
			return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
		}

		/**
		 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
		 * symbols.
		 * @memberOf punycode
		 * @param {String} input The Punycode string of ASCII-only symbols.
		 * @returns {String} The resulting string of Unicode symbols.
		 */
		function decode(input) {
			// Don't use UCS-2
			var output = [],
			    inputLength = input.length,
			    out,
			    i = 0,
			    n = initialN,
			    bias = initialBias,
			    basic,
			    j,
			    index,
			    oldi,
			    w,
			    k,
			    digit,
			    t,
			    /** Cached calculation results */
			    baseMinusT;

			// Handle the basic code points: let `basic` be the number of input code
			// points before the last delimiter, or `0` if there is none, then copy
			// the first basic code points to the output.

			basic = input.lastIndexOf(delimiter);
			if (basic < 0) {
				basic = 0;
			}

			for (j = 0; j < basic; ++j) {
				// if it's not a basic code point
				if (input.charCodeAt(j) >= 0x80) {
					error('not-basic');
				}
				output.push(input.charCodeAt(j));
			}

			// Main decoding loop: start just after the last delimiter if any basic code
			// points were copied; start at the beginning otherwise.

			for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

				// `index` is the index of the next character to be consumed.
				// Decode a generalized variable-length integer into `delta`,
				// which gets added to `i`. The overflow checking is easier
				// if we increase `i` as we go, then subtract off its starting
				// value at the end to obtain `delta`.
				for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

					if (index >= inputLength) {
						error('invalid-input');
					}

					digit = basicToDigit(input.charCodeAt(index++));

					if (digit >= base || digit > floor((maxInt - i) / w)) {
						error('overflow');
					}

					i += digit * w;
					t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

					if (digit < t) {
						break;
					}

					baseMinusT = base - t;
					if (w > floor(maxInt / baseMinusT)) {
						error('overflow');
					}

					w *= baseMinusT;

				}

				out = output.length + 1;
				bias = adapt(i - oldi, out, oldi == 0);

				// `i` was supposed to wrap around from `out` to `0`,
				// incrementing `n` each time, so we'll fix that now:
				if (floor(i / out) > maxInt - n) {
					error('overflow');
				}

				n += floor(i / out);
				i %= out;

				// Insert `n` at position `i` of the output
				output.splice(i++, 0, n);

			}

			return ucs2encode(output);
		}

		/**
		 * Converts a string of Unicode symbols (e.g. a domain name label) to a
		 * Punycode string of ASCII-only symbols.
		 * @memberOf punycode
		 * @param {String} input The string of Unicode symbols.
		 * @returns {String} The resulting Punycode string of ASCII-only symbols.
		 */
		function encode(input) {
			var n,
			    delta,
			    handledCPCount,
			    basicLength,
			    bias,
			    j,
			    m,
			    q,
			    k,
			    t,
			    currentValue,
			    output = [],
			    /** `inputLength` will hold the number of code points in `input`. */
			    inputLength,
			    /** Cached calculation results */
			    handledCPCountPlusOne,
			    baseMinusT,
			    qMinusT;

			// Convert the input in UCS-2 to Unicode
			input = ucs2decode(input);

			// Cache the length
			inputLength = input.length;

			// Initialize the state
			n = initialN;
			delta = 0;
			bias = initialBias;

			// Handle the basic code points
			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue < 0x80) {
					output.push(stringFromCharCode(currentValue));
				}
			}

			handledCPCount = basicLength = output.length;

			// `handledCPCount` is the number of code points that have been handled;
			// `basicLength` is the number of basic code points.

			// Finish the basic string - if it is not empty - with a delimiter
			if (basicLength) {
				output.push(delimiter);
			}

			// Main encoding loop:
			while (handledCPCount < inputLength) {

				// All non-basic code points < n have been handled already. Find the next
				// larger one:
				for (m = maxInt, j = 0; j < inputLength; ++j) {
					currentValue = input[j];
					if (currentValue >= n && currentValue < m) {
						m = currentValue;
					}
				}

				// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
				// but guard against overflow
				handledCPCountPlusOne = handledCPCount + 1;
				if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
					error('overflow');
				}

				delta += (m - n) * handledCPCountPlusOne;
				n = m;

				for (j = 0; j < inputLength; ++j) {
					currentValue = input[j];

					if (currentValue < n && ++delta > maxInt) {
						error('overflow');
					}

					if (currentValue == n) {
						// Represent delta as a generalized variable-length integer
						for (q = delta, k = base; /* no condition */; k += base) {
							t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
							if (q < t) {
								break;
							}
							qMinusT = q - t;
							baseMinusT = base - t;
							output.push(
								stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
							);
							q = floor(qMinusT / baseMinusT);
						}

						output.push(stringFromCharCode(digitToBasic(q, 0)));
						bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
						delta = 0;
						++handledCPCount;
					}
				}

				++delta;
				++n;

			}
			return output.join('');
		}

		/**
		 * Converts a Punycode string representing a domain name or an email address
		 * to Unicode. Only the Punycoded parts of the input will be converted, i.e.
		 * it doesn't matter if you call it on a string that has already been
		 * converted to Unicode.
		 * @memberOf punycode
		 * @param {String} input The Punycoded domain name or email address to
		 * convert to Unicode.
		 * @returns {String} The Unicode representation of the given Punycode
		 * string.
		 */
		function toUnicode(input) {
			return mapDomain(input, function(string) {
				return regexPunycode.test(string)
					? decode(string.slice(4).toLowerCase())
					: string;
			});
		}

		/**
		 * Converts a Unicode string representing a domain name or an email address to
		 * Punycode. Only the non-ASCII parts of the domain name will be converted,
		 * i.e. it doesn't matter if you call it with a domain that's already in
		 * ASCII.
		 * @memberOf punycode
		 * @param {String} input The domain name or email address to convert, as a
		 * Unicode string.
		 * @returns {String} The Punycode representation of the given domain name or
		 * email address.
		 */
		function toASCII(input) {
			return mapDomain(input, function(string) {
				return regexNonASCII.test(string)
					? 'xn--' + encode(string)
					: string;
			});
		}

		/*--------------------------------------------------------------------------*/

		/** Define the public API */
		punycode = {
			/**
			 * A string representing the current Punycode.js version number.
			 * @memberOf punycode
			 * @type String
			 */
			'version': '1.3.2',
			/**
			 * An object of methods to convert from JavaScript's internal character
			 * representation (UCS-2) to Unicode code points, and back.
			 * @see <https://mathiasbynens.be/notes/javascript-encoding>
			 * @memberOf punycode
			 * @type Object
			 */
			'ucs2': {
				'decode': ucs2decode,
				'encode': ucs2encode
			},
			'decode': decode,
			'encode': encode,
			'toASCII': toASCII,
			'toUnicode': toUnicode
		};

		/** Expose `punycode` */
		// Some AMD build optimizers, like r.js, check for specific condition patterns
		// like the following:
		if (
			true
		) {
			!(__WEBPACK_AMD_DEFINE_RESULT__ = function() {
				return punycode;
			}.call(exports, __webpack_require__, exports, module), __WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
		} else if (freeExports && freeModule) {
			if (module.exports == freeExports) { // in Node.js or RingoJS v0.8.0+
				freeModule.exports = punycode;
			} else { // in Narwhal or RingoJS v0.7.0-
				for (key in punycode) {
					punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
				}
			}
		} else { // in Rhino or a web browser
			root.punycode = punycode;
		}

	}(this));
	
	/* WEBPACK VAR INJECTION */}.call(exports, __webpack_require__(19)(module), (function() { return this; }())))

/***/ },
/* 17 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * Reduce `arr` with `fn`.
	 *
	 * @param {Array} arr
	 * @param {Function} fn
	 * @param {Mixed} initial
	 *
	 * TODO: combatible error handling?
	 */

	module.exports = function(arr, fn, initial){  
	  var idx = 0;
	  var len = arr.length;
	  var curr = arguments.length == 3
	    ? initial
	    : arr[idx++];

	  while (idx < len) {
	    curr = fn.call(null, curr, arr[idx], ++idx, arr);
	  }
	  
	  return curr;
	};

/***/ },
/* 18 */
/***/ function(module, exports, __webpack_require__) {

	
	/**
	 * Expose `Emitter`.
	 */

	module.exports = Emitter;

	/**
	 * Initialize a new `Emitter`.
	 *
	 * @api public
	 */

	function Emitter(obj) {
	  if (obj) return mixin(obj);
	};

	/**
	 * Mixin the emitter properties.
	 *
	 * @param {Object} obj
	 * @return {Object}
	 * @api private
	 */

	function mixin(obj) {
	  for (var key in Emitter.prototype) {
	    obj[key] = Emitter.prototype[key];
	  }
	  return obj;
	}

	/**
	 * Listen on the given `event` with `fn`.
	 *
	 * @param {String} event
	 * @param {Function} fn
	 * @return {Emitter}
	 * @api public
	 */

	Emitter.prototype.on =
	Emitter.prototype.addEventListener = function(event, fn){
	  this._callbacks = this._callbacks || {};
	  (this._callbacks[event] = this._callbacks[event] || [])
	    .push(fn);
	  return this;
	};

	/**
	 * Adds an `event` listener that will be invoked a single
	 * time then automatically removed.
	 *
	 * @param {String} event
	 * @param {Function} fn
	 * @return {Emitter}
	 * @api public
	 */

	Emitter.prototype.once = function(event, fn){
	  var self = this;
	  this._callbacks = this._callbacks || {};

	  function on() {
	    self.off(event, on);
	    fn.apply(this, arguments);
	  }

	  on.fn = fn;
	  this.on(event, on);
	  return this;
	};

	/**
	 * Remove the given callback for `event` or all
	 * registered callbacks.
	 *
	 * @param {String} event
	 * @param {Function} fn
	 * @return {Emitter}
	 * @api public
	 */

	Emitter.prototype.off =
	Emitter.prototype.removeListener =
	Emitter.prototype.removeAllListeners =
	Emitter.prototype.removeEventListener = function(event, fn){
	  this._callbacks = this._callbacks || {};

	  // all
	  if (0 == arguments.length) {
	    this._callbacks = {};
	    return this;
	  }

	  // specific event
	  var callbacks = this._callbacks[event];
	  if (!callbacks) return this;

	  // remove all handlers
	  if (1 == arguments.length) {
	    delete this._callbacks[event];
	    return this;
	  }

	  // remove specific handler
	  var cb;
	  for (var i = 0; i < callbacks.length; i++) {
	    cb = callbacks[i];
	    if (cb === fn || cb.fn === fn) {
	      callbacks.splice(i, 1);
	      break;
	    }
	  }
	  return this;
	};

	/**
	 * Emit `event` with the given args.
	 *
	 * @param {String} event
	 * @param {Mixed} ...
	 * @return {Emitter}
	 */

	Emitter.prototype.emit = function(event){
	  this._callbacks = this._callbacks || {};
	  var args = [].slice.call(arguments, 1)
	    , callbacks = this._callbacks[event];

	  if (callbacks) {
	    callbacks = callbacks.slice(0);
	    for (var i = 0, len = callbacks.length; i < len; ++i) {
	      callbacks[i].apply(this, args);
	    }
	  }

	  return this;
	};

	/**
	 * Return array of callbacks for `event`.
	 *
	 * @param {String} event
	 * @return {Array}
	 * @api public
	 */

	Emitter.prototype.listeners = function(event){
	  this._callbacks = this._callbacks || {};
	  return this._callbacks[event] || [];
	};

	/**
	 * Check if this emitter has `event` handlers.
	 *
	 * @param {String} event
	 * @return {Boolean}
	 * @api public
	 */

	Emitter.prototype.hasListeners = function(event){
	  return !! this.listeners(event).length;
	};


/***/ },
/* 19 */
/***/ function(module, exports, __webpack_require__) {

	module.exports = function(module) {
		if(!module.webpackPolyfill) {
			module.deprecate = function() {};
			module.paths = [];
			// module.parent = undefined by default
			module.children = [];
			module.webpackPolyfill = 1;
		}
		return module;
	}


/***/ }
/******/ ])