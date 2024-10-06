# types
types/node_modules:
	echo "Installing types..."
	cd types && npm install

types/out: types/node_modules
	echo "Building types..."
	cd types && tsc

# fix linting errors in types first
#types-lint: types
#	cd types && npm run lint

types: types/out

types-clean:
	rm -rf types/node_modules
	rm -rf types/out

# engine
engine/node_modules:
	echo "Installing engine..."
	cd engine && npm install

engine/out: engine/node_modules
	echo "Building engine..."
	cd engine && tsc

engine: types engine/out

engine-test: engine
	cd engine && jest

engine-lint: engine
	cd engine && npm run lint

engine-clean:
	rm -rf engine/node_modules
	rm -rf engine/out

# cli
cli/node_modules:
	echo "Installing cli..."
	cd cli && npm install

cli/out: cli/node_modules
	echo "Building cli..."
	cd cli && tsc

cli-lint: cli
	cd cli && npm run lint

cli: types engine cli/out

cli-clean:
	rm -rf cli/node_modules
	rm -rf cli/out

# react-app
react-app/node_modules: 
	echo "Installing react-app..."
	cd react-app && npm install

react-app/build: react-app/node_modules
	echo "Building react-app..."
	cd react-app && npm run build

react-app: types engine react-app/build

react-app-test: react-app
	cd react-app && npm test -- --watchAll=false

react-app-start: react-app
	cd react-app && npm start

react-app-clean:
	rm -rf react-app/node_modules
	rm -rf react-app/build

# examples
.PHONY: examples examples-clean
examples: examples/CloakOfDarkness
examples-clean: examples/CloakOfDarkness-clean

## Cloak of darkness
.PHONY: examples/CloakOfDarkness examples/CloakOfDarkness-clean
examples/CloakOfDarkness: cli react-app
	echo "Building Cloak of Darkness..."
	cd examples/CloakOfDarkness && make

examples/CloakOfDarkness-clean:
	cd examples/CloakOfDarkness && make clean

# all
.PHONY: all test lint clean
compile: types engine cli react-app examples
test: engine-test react-app-test
lint: engine-lint cli-lint
all: compile lint test
clean: types-clean engine-clean cli-clean react-app-clean examples-clean

.DEFAULT_GOAL := all
