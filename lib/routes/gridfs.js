import _ from 'lodash-es';
import busboy from 'busboy';
import GridFSStream from 'gridfs-stream';
import mongo from 'mongodb';
import * as utils from '../utils.js';

// var routes = function(config) {
const routes = function () {
  const exp = {};

  // view all files in a bucket
  exp.viewBucket = function (req, res) {
    const { bucketName, dbName, files } = req;
    let columns = ['filename', 'length']; // putting these here keeps them at the front/left

    const statsAvgChunk  = utils.bytesToSize(files.reduce((prev, curr) => prev + curr.chunkSize, 0) / files.length);
    const statsTotalSize = utils.bytesToSize(files.reduce((prev, curr) => prev + curr.length, 0));

    // Iterate through files for a cleanup
    for (const f in files) {
      columns.push(Object.keys(files[f]));                        // Generate an array of columns used by all documents visible on this page
      files[f].length     = utils.bytesToSize(files[f].length);   // Filesizes to something more readable
      delete files[f].chunkSize;                                   // Already taken the average above, no need;
    }

    columns = _.uniq(columns.flat());
    columns.splice(columns.indexOf('_id'), 1);
    columns.splice(columns.indexOf('chunkSize'), 1);

    const ctx = {
      buckets: res.locals.gridFSBuckets[dbName],
      columns,
      files,
      title: 'Viewing Bucket: ' + bucketName,
      stats: {
        avgChunk: statsAvgChunk,
        totalSize: statsTotalSize,
      },
    };

    res.render('gridfs', ctx);
  };

  // upload a file
  exp.addFile = function (req, res) {
    const bb = busboy({ headers: req.headers });
    const newFileID   = new mongo.ObjectId();

    // Pass your bucket name as the second parameter to the create() method to create or reference a bucket
    // with a custom name other than the default name `fs`
    const gfs = new mongo.GridFSBucket(req.db, { bucketName: req.bucketName });

    bb.on('file', function (fieldname, file, info) {
      const { filename, encoding, mimeType } = info;
      if (!filename) {
        req.session.error = 'No filename.';
        return res.redirect('back');
      }

      // WARNING: You should almost never use this value as-is (especially if you are using `preservePath: true` in your `config`)
      // as it could contain malicious input. You are better off generating your own (safe) filenames, or at the very least using
      // a hash of the filename.
      const writeStream = gfs.openUploadStream(filename, {
        id: newFileID,
        contentType: mimeType,
        writeConcern: { w: 'majority' },
        metadata: { filename, encoding, mimeType },
      });
      file.pipe(writeStream);
    }).on('close', function () {
      if (!req.session.error) {
        req.session.success = 'File uploaded!';
      }

      setTimeout(function () {
        // short delay to allow Mongo to finish syncing
        return res.redirect('back');
      }, 500);
    }).on('error', function (err) {
      // we just need to set the error, `close` event will be called after this
      req.session.error = err;
    });

    req.pipe(bb);
  };

  // download a file
  exp.getFile = function (req, res) {
    // Override the bucket name with what is currently selected
    // https://github.com/aheckmann/gridfs-stream/blob/a3b7c4e48a08ac625cf7564304c83e56d6b93821/lib/index.js#L31
    mongo.GridStore.DEFAULT_ROOT_COLLECTION = req.bucketName;

    const gfs = new GridFSStream(req.db, mongo);

    gfs.findOne({ _id: req.fileID }, function (err, file) {
      if (err) {
        console.error(err);
        req.session.error = 'Error: ' + err;
        return res.redirect('back');
      }

      if (!file) {
        console.error('No file');
        req.session.error = 'File not found!';
        return res.redirect('back');
      }

      res.set('Content-Type', file.contentType);
      res.set('Content-Disposition', 'attachment; filename="' + encodeURI(file.filename) + '"');

      const readstream = gfs.createReadStream({
        _id: file._id,
      });

      readstream.on('error', function (err) {
        console.error('Got error while processing stream ' + err.message);
        req.session.error = 'Error: ' + err;
        res.end();
      });

      readstream.pipe(res);
    });
  };

  // delete a file
  exp.deleteFile = function (req, res) {
    // Override the bucket name with what is currently selected
    // https://github.com/aheckmann/gridfs-stream/blob/a3b7c4e48a08ac625cf7564304c83e56d6b93821/lib/index.js#L31
    mongo.GridStore.DEFAULT_ROOT_COLLECTION = req.bucketName;

    const gfs = new GridFSStream(req.db, mongo);

    gfs.remove({ _id: req.fileID }, function (err) {
      if (err) {
        req.session.error = 'Error: ' + err;
        return res.redirect('back');
      }

      req.session.success = 'File _id: "' + req.fileID + '" deleted! ';
      setTimeout(function () {
        // short delay to allow Mongo to finish syncing
        return res.redirect('back');
      }, 500);
    });
  };

  // add bucket
  exp.addBucket = function (req, res) {
    req.session.error('addBucket not implemented yet');
    res.redirect('back');

    // req.session.success = 'Bucket created!';
  };

  // delete bucket
  exp.deleteBucket = function (req, res) {
    req.session.error('deleteBucket not implemented yet');
    res.redirect('back');

    // req.session.success = 'Bucket deleted!';
  };

  exp.renameBucket = function (req, res) {
    req.session.error('renameBucket not implemented yet');
    res.redirect('back');
  };

  return exp;
};

export default routes;
