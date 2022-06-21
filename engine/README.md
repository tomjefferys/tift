# TIFT engine

This is the core component of TIFT

## Building

```
$ tsc
```

## Running tests
```
$ jest
```

### Running all tests in a particular file
```sh
$ jest out/test/enginebuildertest.js
```

### Running a single test case
```sh
$ jest -t 'name of test case to run'
```

### Debugging jest tests
```sh
node --inspect-brk node_modules/.bin/jest [any other arguments here]
```

Create the following `.vscode/launch.json`
```json
{
    "version": "0.2.0",
    "configurations": [
        {
            "type": "node",
            "request": "attach",
            "name": "Attach",
            "port": 9229
        }
    ]
}
```

## Linting
```sh
$ npm run lint
```