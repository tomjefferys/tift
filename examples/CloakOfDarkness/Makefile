build/webapp : ../../react-app/build build build/adventure.yaml
	mkdir -p build/webapp && \
	cp -r ../../react-app/build/* build/webapp && \
	cp build/adventure.yaml build/webapp

build :
	mkdir -p build

build/properties.yaml : src/properties.yaml
	cp src/properties.yaml build/properties.yaml

build/adventure.yaml : $(shell find src -name "*.yaml")
	find src -name '*.yaml'|xargs -I {} sh -c 'printf "\n--- # {}\n"; cat {}' > build/adventure.yaml

clean : 
	rm -rf build