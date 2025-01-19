import paho.mqtt.client as mqtt
from datetime import datetime, timedelta
import json
import os

# TTN settings
TTN_BROKER = "eu1.cloud.thethings.network"  # Update region if necessary (e.g., 'nam1' for North America)
TTN_PORT = 1883
TTN_USERNAME = "nanosniff-rak@ttn"  # Your TTN application ID
TTN_PASSWORD = "NNSXS.33POV3OVXEDTIKUJV6J7JICDSHIJ5YHRR52EBJA.HHB6Q26UFNKM4G7TBUTSVKIZQKFUQI3JGZ4BVQZZRLY643BEI3SA"  # Your TTN access key (from TTN console)

# Device specifics
TTN_TOPIC = "v3/+/devices/+/up"  # Subscribe to all devices or specify device ID instead of '+'

# Define the file path for the output
output_file = 'data.txt'

def convert_timestamp_to_ist(timestamp):
    # Convert the timestamp to a datetime object
    #utc_time = datetime.utcfromtimestamp(timestamp)
    timenew = timestamp.replace("T", " ")
    index = timenew.rfind(".")
    utc_time = datetime.strptime(str(timenew[:index]), '%Y-%m-%d %H:%M:%S')
  
    # Define the IST timezone offset (UTC +5:30)
    ist_offset = timedelta(hours=5, minutes=30)
    
    # Convert UTC time to IST
    ist_time = utc_time + ist_offset
    #print(ist_time)
    
    # Format the datetime to a readable string
    #return ist_time.strftime('%Y-%m-%d %H:%M:%S')
    return str(ist_time)

# Callback when the client receives a connection response from the server
def on_connect(client, userdata, flags, rc):
    print(f"Connected to TTN with result code {rc}")
    # Subscribing to the uplink message topic
    client.subscribe(TTN_TOPIC)

# Callback when a message is received
def on_message(client, userdata, msg):
    print(f"Message received on topic {msg.topic}")
    payload = json.loads(msg.payload.decode('utf-8'))
    
    # Extract only the decoded_payload
    dev_address = payload.get('end_device_ids', {}).get('dev_addr', {})
    f_count = payload.get('uplink_message', {}).get('f_cnt', {})
    #time_stamp = payload.get('uplink_message', {}).get('settings', {}).get('timestamp', {})
    time_stamp = payload.get('uplink_message', {}).get('received_at', {})
    current_time = convert_timestamp_to_ist(time_stamp)
    spreading_factor = payload.get('uplink_message', {}).get('settings', {}).get('data_rate', {}).get('lora', {}).get('spreading_factor', {})
    data = payload.get('uplink_message', {}).get('frm_payload', {})
    Frequency = payload.get('uplink_message', {}).get('settings', {}).get('frequency', {})
    rssi = payload["uplink_message"]["rx_metadata"][0]["rssi"]
    snr = payload["uplink_message"]["rx_metadata"][0]["snr"]
    bandwidth = payload.get('uplink_message', {}).get('settings', {}).get('data_rate', {}).get('lora', {}).get('bandwidth', {})
    f_port = payload.get('uplink_message', {}).get('f_port', {})
    
    decoded = {
        "Dev_Address": dev_address,
        "Fcnt": f_count,
        "Time": current_time,
        "SF": spreading_factor,
        "Data": data,
        "Freq": Frequency,
        "RSSI": rssi,
        "SNR": snr,
        "BW": bandwidth,
        "Port": f_port
    }
    
    # Pretty print the decoded payload
    if decoded:
        print(json.dumps(decoded, indent=4))
        # Write the decoded data to the output file
        with open(output_file, 'a') as file:
            file.write(json.dumps(decoded) + '\n')  # Write each decoded payload on a new line
    else:
        print("No decoded payload found so check decoder in TTN.")

# Create an MQTT client instance
client = mqtt.Client()

# Set username and password for TTN connection
client.username_pw_set(TTN_USERNAME, TTN_PASSWORD)

# Assign event callbacks
client.on_connect = on_connect
client.on_message = on_message

# Check if the output file exists; if not, create it
folderPath = os.path.dirname(__file__)
output_file = os.path.join(folderPath, output_file)
if not os.path.exists(output_file):
    with open(output_file, 'w') as file:
        file.write('')  # Create an empty file

# Connect to the TTN MQTT broker
client.connect(TTN_BROKER, TTN_PORT, 60)

# Blocking loop to process network traffic and dispatch callbacks
try:
    client.loop_forever()
except KeyboardInterrupt:
    print("Disconnecting from the broker...")
finally:
    client.disconnect()  # Ensure proper disconnection from the broker

