from flask import Flask, render_template, request, make_response, redirect
import flask

ui = flask.Blueprint('ui', __name__, template_folder='templates')

def create_app():
  app = Flask(__name__)

  app.register_blueprint(ui)

  return app

@ui.route("/")
def index():
    return render_template("index.html")

@ui.route("/testpropedit")
def testpropedit():
    return render_template("testpropedit.html")

if __name__ == "__main__":
  app = create_app()
  app.run(host='0.0.0.0', port=2222, debug=app.config["DEBUG"])
