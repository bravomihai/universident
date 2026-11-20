.PHONY: dev dev-stop prod demo_data pacient student

prod_compose = docker compose -f compose.yaml --profile prod --profile tools
# Use the existing verified local demo accounts unless ARGS is supplied.
demo_args = $(if $(strip $(ARGS)),$(ARGS),--patient-email=pacient@dev.com --student-email=student@dev.com)

dev dev-stop:
	@mkdir -p -m 700 .local-dev
	@flock --close --wait 180 .local-dev/stack.lock node scripts/dev-stack.mjs $@

prod:
	@set -e; \
	lock_path="$$(git rev-parse --absolute-git-dir)/universident-deploy.lock"; \
	{ \
		flock --exclusive --wait 60 9; \
		$(prod_compose) config --quiet; \
		$(prod_compose) build app migrate chat-email-worker; \
		$(prod_compose) up -d --no-recreate --wait --wait-timeout 180 db; \
		db_empty="$$( $(prod_compose) run --rm --no-deps -T migrate node scripts/prod-db-empty.mjs)"; \
		if [ "$$db_empty" = true ]; then \
			$(prod_compose) run --rm --no-deps -T migrate; \
		fi; \
		if ! $(prod_compose) run --rm --no-deps -T migrate npx --no-install prisma migrate status >/dev/null 2>&1; then \
			printf '%s\n' 'Database migration status is not clean. See docs/deployment.md.' >&2; \
			exit 1; \
		fi; \
		$(prod_compose) up -d --no-deps --no-build --pull never --wait --wait-timeout 180 app chat-email-worker; \
	} 9>"$$lock_path"

demo_data:
	npm run demo:seed -- $(demo_args)

# Pass credentials as data so Make and the shell leave password characters untouched.
pacient student: private override export ARGS := $(value ARGS)
pacient student:
	@./node_modules/.bin/tsx scripts/create-local-account.ts $@
