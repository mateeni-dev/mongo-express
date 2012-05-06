//Add routes from other files
var db = require('./database');
var coll = require('./collection');
var doc = require('./document');

exports.viewDatabase = db.viewDatabase;

exports.viewCollection = coll.viewCollection;
exports.addCollection = coll.addCollection;
exports.deleteCollection = coll.deleteCollection;
exports.renameCollection = coll.renameCollection;

exports.viewDocument = doc.viewDocument;
exports.updateDocument = doc.updateDocument;


//Homepage route
exports.index = function(req, res) {
  req.adminDb.serverStatus(function(err, info) {
    if (err) {
      //TODO: handle error
      console.error(err);
    }

    var ctx = {
      title: 'Mongo Express',
      info: info
    };
    res.render('index', ctx);
  });
};
