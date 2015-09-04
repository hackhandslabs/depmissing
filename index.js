var fs = require("fs");
var path = require("path");
var detective = require('detective');
var q = require('q');
var walkdir = require("walkdir");
var _ = require('lodash');
var minimatch = require('minimatch');
var util = require('util');
var fs = require('fs');
var merge = require('merge');

function getModulesRequiredFromFilename(filename) {
  var content = fs.readFileSync(filename, "utf-8");
  try {
    return detective(content, {
      word: '',
      isRequire: function(node) {
        var callee = node.callee;
        return callee &&
          (
            (node.type === 'CallExpression' && callee.type === 'Identifier'
            && callee.name === 'require')
            ||
            (callee.property && callee.property.name === 'loadNpmTasks')
          );
      }
    });
  } catch (err) {
    return err;
  }
}

var missing = {};
function checkDirectory(dir, ignoreDirs, deps, ignorePackages) {

  var deferred = q.defer();
  var directoryPromises = [];
  var finder = walkdir(dir, { "no_recurse": true });
  var invalidFiles = {};

  finder.on("directory", function (subdir) {
    if (_.contains(ignoreDirs, path.basename(subdir))
      || (_.isEmpty(deps)))  {
        return;
    }

    directoryPromises.push(checkDirectory(subdir, ignoreDirs, deps, ignorePackages));
  });

  finder.on("file", function (filename) {
    if (path.extname(filename) === ".js") {
      var modulesRequired = getModulesRequiredFromFilename(filename);
      if (util.isError(modulesRequired)) {
        invalidFiles[filename] = modulesRequired;
      } else {
        modulesRequired = modulesRequired.map(function (module) {
          return module.replace ? module.replace(/\/.*$/, '') : module;
        });

        var toCompare = _.difference(modulesRequired, ignorePackages);
        var diff = _.difference(toCompare, deps);
        diff.forEach(function(item){
          missing[item] = filename;
        });
        //missing = _.uniq(missing.concat(diff));
        //console.log(missing);
        //deps = _.difference(modulesRequired, deps);
        //devDeps = _.difference(modulesRequired, devDeps);
      }
    }
  });

  finder.on("end", function () {
    deferred.resolve(q.allSettled(directoryPromises).then(function(directoryResults) {

      _.each(directoryResults, function(result) {
        if (result.state === 'fulfilled') {
          invalidFiles = _.merge(invalidFiles, result.value.invalidFiles, {});
          deps = _.intersection(deps, result.value.dependencies);
        }
      });

      return {
        missing: missing,
        dependencies: deps,
        devDependencies: [],
        invalidFiles: invalidFiles
      };
    }));
  });

  return deferred.promise;
}

function depCheck(rootDir, options, cb) {

  var pkg = require(path.join(rootDir, 'package.json'));

  var rcPath = path.join(rootDir, '.missingdepsrc');
  var rc = (fs.existsSync(rcPath)) ? JSON.parse(fs.readFileSync(rcPath, 'utf-8')) : {};
  var deps = Object.keys(merge(pkg.dependencies, pkg.devDependencies));

  var ignoreDirs = _([
      '.git',
      '.svn',
      '.hg',
      '.idea',
      'node_modules',
      'bower_components'
    ])
    .concat(options.ignoreDirs)
    .concat(rc.ignore)
    .flatten()
    .unique()
    .valueOf();

  var ignorePackages = _((rc.ignoreModules) ? rc.ignoreModules : [])
  .concat(options.ignorePackages)
  .concat([
    '.',
    '..',
    "child_process",
    "cluster",
      "crypto",
      "dns",
      "domain",
      "events",
      "fs",
      "http",
      "https",
      "net",
      "os",
      "path",
      "punycode",
      "querystring",
      "readline",
      "smalloc",
      "stream",
      "string_decoder",
      "tls",
      "dgram",
      "url",
      "util",
      "vm",
      "zlib"
  ])
  .flatten()
  .unique()
  .valueOf();

  function isIgnored(dependency) {
    return _.any(options.ignoreMatches, function(match) {
      return minimatch(dependency, match);
    });
  }

  function hasBin(dependency) {
    try {
      var depPkg = require(path.join(rootDir, "node_modules", dependency, "package.json"));
      return _.has(depPkg, 'bin');
    } catch (e) {}
  }

  function filterDependencies(dependencies) {
    return _(dependencies)
      .keys()
      .reject(hasBin)
      .reject(isIgnored)
      .valueOf();
  }

  return checkDirectory(rootDir, ignoreDirs, deps, ignorePackages)
    .then(cb)
    .done();
}

module.exports = depCheck;
