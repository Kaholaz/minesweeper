.PHONY: setup build all

build:
	tsc

clean:
	rm **/*.js

all: build
