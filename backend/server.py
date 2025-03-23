import firebase_admin
from firebase_admin import credentials, firestore
from flask import Flask, jsonify, request
from flask_cors import CORS

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Initialize Firebase
cred = credentials.Certificate("firebase-config.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# GET route to fetch parking slots
@app.route("/parking-slots", methods=["GET"])
def get_parking_slots():
    slots_ref = db.collection("parking_slots").stream()
    slots = [{"id": slot.to_dict()["id"], "occupied": slot.to_dict()["occupied"]} for slot in slots_ref]
    return jsonify(slots)

# POST route to reserve a parking slot
@app.route("/reserve-slot/<int:slot_id>", methods=["POST"])
def reserve_slot(slot_id):
    slot_ref = db.collection("parking_slots").where("id", "==", slot_id).limit(1).stream()
    for slot in slot_ref:
        doc_id = slot.id
        slot_data = slot.to_dict()
        if not slot_data["occupied"]:
            db.collection("parking_slots").document(doc_id).update({"occupied": True})
            return jsonify({"message": "Slot reserved successfully"}), 200
    return jsonify({"error": "Slot not available"}), 400

if __name__ == "__main__":
    app.run(debug=True)
