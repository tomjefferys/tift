build/adventure.yaml : $(shell find src -name "*.yaml")
	mkdir -p build && \
	find src -name '*.yaml'|xargs -I {} sh -c 'printf "\n--- # {}\n"; cat {}' > build/adventure.yaml

clean :
	rm -rf build
