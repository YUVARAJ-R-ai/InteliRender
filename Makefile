.PHONY: dev prod down logs ps build

dev:
	docker compose up --build

prod:
	docker compose -f docker-compose.yml up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

build:
	docker compose build
