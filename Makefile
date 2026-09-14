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
	cd cli && npm run build

cli-lint: cli
	cd cli && npm run lint

cli/out/tift.js: cli/out

cli: types engine cli/out

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
examples: examples/CloakOfDarkness examples/GoblinThief
examples-test: examples/CloakOfDarkness-test examples/CloakOfDarkness-test-dev examples/GoblinThief-test
examples-clean: examples/CloakOfDarkness-clean examples/GoblinThief-clean

## Cloak of darkness
.PHONY: examples/CloakOfDarkness examples/CloakOfDarkness-test examples/CloakOfDarkness-test-dev examples/CloakOfDarkness-clean
examples/CloakOfDarkness: cli react-app
	echo "Building Cloak of Darkness..."
	cd examples/CloakOfDarkness && make

examples/CloakOfDarkness-test: examples/CloakOfDarkness
	cd examples/CloakOfDarkness && cat test.txt | ../../cli/out/main.mjs \
	 build/webapp/stdlib.yaml \
	 build/webapp/properties.yaml \
	 build/webapp/adventure.yaml

examples/CloakOfDarkness-test-dev: examples/CloakOfDarkness
	cd examples/CloakOfDarkness && cat test_dev.txt | ../../cli/out/main.mjs \
	 build/webapp/stdlib.yaml \
	 build/webapp/properties.yaml \
	 build/webapp/adventure.yaml

examples/CloakOfDarkness-clean:
	cd examples/CloakOfDarkness && make clean

## The Goblin's Errand - a minimal NPC-agent demo (see docs/traits.md#agent and
## docs/functions.md#createPlanFor). Doesn't need react-app: it's tested purely
## through the cli, reading stdlib/properties straight from resources/ rather
## than from a built webapp bundle.
.PHONY: examples/GoblinThief examples/GoblinThief-test examples/GoblinThief-clean
examples/GoblinThief: cli
	echo "Building The Goblin's Errand..."
	cd examples/GoblinThief && make

examples/GoblinThief-test: examples/GoblinThief
	cd examples/GoblinThief && cat test.txt | ../../cli/out/main.mjs \
	 ../../resources/stdlib.yaml \
	 ../../resources/properties.yaml \
	 build/adventure.yaml

examples/GoblinThief-clean:
	cd examples/GoblinThief && make clean

# all
.PHONY: all test lint clean
compile: types engine cli react-app examples
test: engine-test cli-test react-app-test examples-test
lint: types-lint engine-lint cli-lint
all: compile lint test
clean: types-clean engine-clean cli-clean react-app-clean examples-clean

.DEFAULT_GOAL := all
