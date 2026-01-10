# types
types/node_modules:
	echo "Installing types..."
	cd types && npm install

types/out: types/node_modules
	echo "Building types..."
	cd types && npx tsc

types-lint: types
	cd types && npm run lint

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
	cd engine && npx tsc

engine: types engine/out

engine-test: engine
	cd engine && npx vitest --run

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
	cd cli && npx tsc

cli-lint: cli
	cd cli && npm run lint

cli/out/tift.js: cli/out
	echo "Bundling cli..."
	cd cli && npx esbuild out/src/main.js --bundle --minify --platform=node --outfile=out/tift.js

cli-install: cli/out
	echo "Installing cli..."
	cd cli && npm install -g

cli-uninstall:
	echo "Uninstalling cli..."
	cd cli && npm uninstall -g

cli: types engine cli/out cli/out/tift.js

cli-test: cli
	cd cli && npx vitest --run

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
	cd react-app && npm test -- --run

react-app-start: react-app
	cd react-app && npm start

react-app-clean:
	rm -rf react-app/node_modules
	rm -rf react-app/build

# examples
.PHONY: examples examples-test examples-clean
examples: examples/CloakOfDarkness
examples-test: examples/CloakOfDarkness-test
examples-clean: examples/CloakOfDarkness-clean

## Cloak of darkness
.PHONY: examples/CloakOfDarkness examples/CloakOfDarkness-test examples/CloakOfDarkness-clean
examples/CloakOfDarkness: cli react-app
	echo "Building Cloak of Darkness..."
	cd examples/CloakOfDarkness && make

examples/CloakOfDarkness-test: examples/CloakOfDarkness cli-install
	cd examples/CloakOfDarkness && cat test.txt | tift \
	 build/webapp/stdlib.yaml \
	 build/webapp/properties.yaml \
	 build/webapp/adventure.yaml

examples/CloakOfDarkness-clean:
	cd examples/CloakOfDarkness && make clean

# all
.PHONY: all test lint install uninstall clean
compile: types engine cli react-app examples
test: engine-test cli-test react-app-test examples-test
lint: types-lint engine-lint cli-lint
install: cli-install
uninstall: cli-uninstall
all: compile lint install test
clean: types-clean engine-clean cli-clean cli-uninstall react-app-clean examples-clean

.DEFAULT_GOAL := all
