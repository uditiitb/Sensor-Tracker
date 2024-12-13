import base64
import json
import time
import os

# Function to decode base64 data
def decode_data(encoded_data):
    if isinstance(encoded_data, dict):
        print(f"Error: Encoded data is a dict, expected a string. Encoded data: {encoded_data}")
        return None
    try:
        decoded_bytes = base64.b64decode(encoded_data)
        return decoded_bytes
    except Exception as e:
        print(f"Error decoding base64 data: {e}")
        return None

# Function to convert data for Dev_Address 260B0B32 (hexadecimal representation)
def format_as_hex(decoded_bytes):
    return ''.join([f'{byte:02x}' for byte in decoded_bytes])

# Function to convert hexadecimal to decimal
def hex_to_decimal(hex_string):
    hex_pairs = [hex_string[i:i + 4] for i in range(0, len(hex_string), 4)]
    decimal_values = []

    for hex_pair in hex_pairs:
        decimal_value = int(hex_pair, 16)
        if decimal_value > 32767:
            decimal_value -= 65536  # Convert to signed value
        decimal_values.append(decimal_value)

    return decimal_values

# Function to convert data for Dev_Address 260BACE8 (signed integers)
def format_as_signed_integers(decoded_bytes):
    try:
        decoded_str = decoded_bytes.decode('utf-8', errors='replace')  # Replace invalid characters
    except Exception as e:
        print(f"Error decoding bytes to string: {e}")
        return None

    string_values = decoded_str.split(' ')

    int_values = []
    for value in string_values:
        try:
            int_value = int(value)
            int_values.append(int_value)
        except ValueError:
            continue

    # Group the integer values in sets of three and format them
    grouped_values = []
    for i in range(0, len(int_values), 3):
        grouped_values.append(' '.join(map(str, int_values[i:i + 3])))

    return '\n'.join(grouped_values)  # Join all grouped strings with new lines

# Function to convert data for Dev_Address 260B1B35 (floating-point values)
def format_as_floats(decoded_bytes):
    decoded_str = decoded_bytes.decode('utf-8', errors='replace').replace('\x00', '')  # Remove null characters
    float_values = []

    # Handle float conversion and catch any issues
    for value in decoded_str.split():
        try:
            float_values.append(float(value))
        except ValueError:
            print(f"Error converting value to float: {value}")

    int_values = [int(value) for value in float_values]  # Convert to integer to remove decimal places

    grouped_values = []
    for i in range(0, len(int_values), 3):
        grouped_values.append(' '.join(map(str, int_values[i:i + 3])))

    return '\n'.join(grouped_values)  # Join all grouped strings with new lines

# Function to format decimal values in groups of three
def format_in_groups_of_three(decimal_values):
    grouped_values = []
    for i in range(0, len(decimal_values), 3):
        group = decimal_values[i:i + 3]
        grouped_values.append(f"({',  '.join(map(str, group))})")
    return '\n'.join(grouped_values)




def do(arg1,arg2):
    # line = line.strip()

    # try:
    #     json_message = json.loads(line)
    # except json.JSONDecodeError as e:
    #     print(f"Error decoding JSON: {e} for line: {line}")
    #     return


    dev_address = arg1
    encoded_data = arg2

    # if not encoded_data:
    #     print(f"No 'Data' field found in message: {json_message}")
    #     return

    decoded_bytes = decode_data(encoded_data)
    if decoded_bytes is None:
        return

    if dev_address == "260BEA15":
        formatted_data = format_as_hex(decoded_bytes)
        decimal_values = hex_to_decimal(formatted_data)
        grouped_data = format_in_groups_of_three(decimal_values)
        return grouped_data
        # return [','.join(line.split()) for line in grouped_data.strip().split('\n')]
        # print(f"Data for Dev_Address {dev_address}:\n{grouped_data}")
        # store_data(dev_address, grouped_data)

    elif dev_address == "260B5630":
        formatted_data = format_as_signed_integers(decoded_bytes)
        if formatted_data:
            return formatted_data
            # return [','.join(line.split()) for line in formatted_data.strip().split('\n')]
            # print(f"Data for Dev_Address {dev_address}:\n{formatted_data}")
            # store_data(dev_address, formatted_data)

    elif dev_address == "260B277F":
        formatted_data = format_as_floats(decoded_bytes)
        return formatted_data
        # return [','.join(line.split()) for line in formatted_data.strip().split('\n')]
        # print(f"Data for Dev_Address {dev_address}:\n{formatted_data}")
        # store_data(dev_address, formatted_data)

    else:
        print(f"No processing rules for Dev_Address: {dev_address}")

def dummy(arg1,arg2):
    return 12


if __name__ == "__main__":
    import sys
    # arg1 = '260B5630'
    # arg2 = "+msC5D+G+igClz/6+psDNkGH+dgCakBH+oYDB0C9+hsC0ECQ+pgDBUB7+nYDWkAp+lMDJEBr+l8DKUCY+nYDKT98+n8C+kAK+kADEEDu+tIDIz/r+oMDI0Dt+msDAUBq+tEDWkAe+m0DSUAm+oEDF0C3+hQDK0C0"
    # arg2 = "AAD9AI0AZQDeACYABgAnAAYADQAAAM8AvQAGAGUABgBGAAAABgDdAO0AZQDDACYABgDGAAYALQAAANgAfQAGAGUABgAmAAAAJwA9AC0AZQDHAEYABgCmAAYADQAAANMAvQAGAGUABgBGAAAARgD9AK0AZQDYAEYABgAmAAcArQAAAMUAPQAG"

    arg1 = sys.argv[1]  # Get argument passed from Node.js
    arg2 = sys.argv[2]  # Get argument passed from Node.js
    print(do(arg1,arg2)) 
