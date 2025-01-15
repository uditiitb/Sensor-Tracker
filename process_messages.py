import base64
import json
import time
import os

# Function to decode base64 data
def decode_data(encoded_data):
    if isinstance(encoded_data, dict):
        # print(f"Error: Encoded data is a dict, expected a string. Encoded data: {encoded_data}")
        return None
    try:
        decoded_bytes = base64.b64decode(encoded_data)
        return decoded_bytes
    except Exception as e:
        # print(f"Error decoding base64 data: {e}")
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

# Function to convert data for Dev_Address 260BF43E (signed integers)
def format_as_signed_integers(decoded_bytes):
    decoded_str = decoded_bytes.decode('utf-8')
    string_values = decoded_str.split(' ')
    
    int_values = []
    for value in string_values:
        try:
            int_value = int(value)
            int_values.append(int_value)
        except ValueError:
            pass
    
    return ' '.join(map(str, int_values))

# Function to format decimal values in groups of three
# def format_in_groups_of_three(decimal_values):
#     grouped_values = []
#     for i in range(0, len(decimal_values), 3):
#         grouped_values.append(' '.join(map(str, decimal_values[i:i + 3])))
#     return '\n'.join(grouped_values)
# Function to format decimal values in groups of three
def format_in_groups_of_three(decimal_values):
    grouped_values = []
    for i in range(0, len(decimal_values), 3):
        group = decimal_values[i:i + 3]
        grouped_values.append(f"({',  '.join(map(str, group))})")
    return '\n'.join(grouped_values)



def do(arg1,arg2):


    sensor_type = arg1
    encoded_data = arg2

    # if not encoded_data:
    #     print(f"No 'Data' field found in message: {json_message}")
    #     return

    decoded_bytes = decode_data(encoded_data)
    # print('decoded bytes=> ',decoded_bytes)
    if decoded_bytes is None:
        return

    if sensor_type == "K":
        formatted_data = format_as_hex(decoded_bytes)
        decimal_values = hex_to_decimal(formatted_data)
        grouped_data = format_in_groups_of_three(decimal_values)
        return grouped_data
        # return [','.join(line.split()) for line in grouped_data.strip().split('\n')]
        # print(f"Data for Dev_Address {dev_address}:\n{grouped_data}")
        # store_data(dev_address, grouped_data)

    elif sensor_type == "A":
        formatted_data = format_as_signed_integers(decoded_bytes)
        grouped_data = format_in_groups_of_three(
            list(map(int, formatted_data.split()))
        )  # Group the signed integers in threes
        return grouped_data

    else:
        print(f"No processing rules for Dev_Address: {sensor_type}")


def do1(arg1,arg2):
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

    formatted_data = format_as_hex(decoded_bytes)
    decimal_values = hex_to_decimal(formatted_data)
    grouped_data = format_in_groups_of_three(decimal_values)
    if grouped_data != None:
        print(1)
        return grouped_data
    else:
        print(2)
        formatted_data = format_as_signed_integers(decoded_bytes)
        if formatted_data:
            return formatted_data


#     return None


# def dummy(arg1,arg2):
#     return 12


if __name__ == "__main__":
    import sys
    # arg1 = 'A'
    # arg2='AAC0AM0AZQDfAIYABgCHAKYAjQDAAM8ACAAGAEUApgCmAMAAZwDSAO0ARQDEAIYABwAmAKYATQDAANkAUQAGAGUApgCGAMAA5gALAA0ARQDVAMYABgAGAKYAbQDAANoACAAGAA=='
    # arg2= 'AAA9AE0AZQDCACYABgBmAAYAbQAAAMoA3QAGAGUABgBGAAAAJwCdAM0AZQDAACYABgDmAAYADQAAAMsA/QAGAGUABgAmAAAAJgC9AE0AZQDIACYABgBmAAYAjQAAAMsAfQAGAGUABwBGAAAAJgCdAK0AZQDQACYABgAmAAcATQAAANcA/QAG'
    # arg2= '+swDikCV+tcDpEDv+rIDgkAh+pUD5kCo+sgDY0AB+kkDQkB0+wQC+UB0+v4EvEBn+n4DIUCT+xcD0kA2+2ADzkCo+ooDUUBf+w4DdEA++ukDtkBd+tQD8UDd+lsDqD9S+uADkUAn+uUDjj+R+vgEEUBQ+p0DUEAC'
    # arg2 = "+msC5D+G+igClz/6+psDNkGH+dgCakBH+oYDB0C9+hsC0ECQ+pgDBUB7+nYDWkAp+lMDJEBr+l8DKUCY+nYDKT98+n8C+kAK+kADEEDu+tIDIz/r+oMDI0Dt+msDAUBq+tEDWkAe+m0DSUAm+oEDF0C3+hQDK0C0"
    # arg2 = "AAAzADYAZgDLAOYABgCGAKYA9gBAAMIAkgAHAGYApgAnAEAAZgDyAJYAhgDEACcABgBGAKYAdgBAAMMAUgAGAGYApgCGAEAABgCzADYAZgDaAGYABgBmAKYAFgBAAM0AMgAGAIYApgDmAEAABgDSABYAhgDZAEYABgCGAKYAdgBAANMA8gAG"
    # arg3 = "ATs/6QFRAUc/7gBnAcxAGAHdAbE/+gC8ARc/5gGRAT1APwFnAcFAVQGiAdk/xwDiAWtAFf/aAZA/ugKZAUdAtQCOAdJAQgCoAZRABgF4AVc/xgEgAZxAKgEMAR1AbQE7ATNAAwDXAZQ/UADWATNAgADzAWc/9ADz"
    # arg3 = "AAAdAG0AZQDGAEYABgDmAAYATQAAANMAnQAGAGUABgAmAAAARgB9AA0AZQDIACYABgBmAAcAbQAAAMEAXQAGAIUABwBGAAAABwB9AI0AZQDBAEYABwAGAAYA7QAAAM8APQAHAGUABgBGAAAABgAdAK0AZQDZAEYABgDnAAYAzQAAAMMAPQAG/QAG"
    arg1 = sys.argv[1]  # Get argument passed from Node.js
    arg2 = sys.argv[2]  # Get argument passed from Node.js
    print(do(arg1,arg2)) 
    # print(arg2.decode('utf-8', errors='replace'))
