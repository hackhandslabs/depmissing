# depmissing

Sometimes you could install a dependency an forget to install with `--save`, if it happens, your project will work in your machine but can break in a build or in other machine. `depmissing` helps you find node modules that you are using but is not in `package.json`.

depmissing was made based on [depcheck](https://github.com/rumpl/depcheck).

## Installation

`npm install depmissing -g`

## Usage

`depmissing <directory>`

Where `<directory>` is the root directory of your application (where the package.json is).

### Options

`--ignore` : list of directories that should be ignored.

`--ignoreModules` : list of modules that should be ignored.

### .missingdepsrc
You can also specify the options to `depmissing` into a '.missingdepsrc' file in the root of your project.

```
{
  "ignore": ["vendor", "build", "specs", "fixtures"],
  "ignoreModules": ["app"]
  ]
}
```

## License

[MIT](http://rumpl.mit-license.org)
