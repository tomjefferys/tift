# Getting Started

The easiest way to get started for now is to check out an existing project.

Eg see: [https://github.com/tomjefferys/CloakOfDarkness](https://github.com/tomjefferys/CloakOfDarkness)

This should be buildable on any linux/mac, and on windows using WSL.

Simply run `make` in the project root.

The game can the be hosted locally using python.

```
$ make
$ python -m http.server --directory build/webapp
```

The game should be playable on `http://localhost:8000`
