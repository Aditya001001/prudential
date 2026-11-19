"""RQ task entry point. Imports the Flask app only inside the worker process."""


def run_generation_job(generation_id):
    from app_with_db import app, process_generation_job
    with app.app_context():
        return process_generation_job(generation_id)
