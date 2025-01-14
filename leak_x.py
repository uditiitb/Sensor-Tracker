import os
import time
import pandas as pd
import numpy as np
from openpyxl.workbook import Workbook
from io import StringIO

def process_data_in_real_time(new_lines, output_path):
    data = []
    for line in new_lines:
        fields = line.strip().split()
        data.append(fields[:3])

    df = pd.DataFrame(data, columns=['X', 'Y', 'Z'])

    for col in df.columns:
        df[col] = pd.to_numeric(df[col], errors='coerce')

    if not os.path.exists(output_path):
        with pd.ExcelWriter(output_path, mode='w', engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="Processed Data")
    else:
        existing_df = pd.read_excel(output_path, sheet_name="Processed Data")
        combined_df = pd.concat([existing_df, df], ignore_index=True)
        with pd.ExcelWriter(output_path, mode='w', engine='openpyxl') as writer:
            combined_df.to_excel(writer, index=False, sheet_name="Processed Data")

    print(f"Processed and appended {len(new_lines)} lines to {output_path}.")
    check_and_analyze_data(output_path)

last_processed_index = 0

def check_and_analyze_data(output_path):
    global last_processed_index  # Use global to keep track of the last processed index across calls
    df = pd.read_excel(output_path, sheet_name="Processed Data")

    # Ensure there are enough data points to create at least one chunk
    if len(df) < 100:
        print("Not enough data points (less than 100). Waiting for more data...")
        return

    # Start creating chunks of 100 data points with a step size of 50
    start_idx = last_processed_index  # Start from the last processed index
    while start_idx + 100 <= len(df):
        end_idx = start_idx + 100
        chunk = df.iloc[start_idx:end_idx]

        # Perform analysis on the chunk and pass the start and end indices
        analyze_chunk(chunk, start_idx, end_idx)

        # Move to the next chunk with a step size of 50
        start_idx += 50

    # Update the last processed index
    last_processed_index = start_idx
    print("Finished processing available chunks. Waiting for more data...")

def analyze_chunk(df, start_idx, end_idx):
    columns_to_calculate = ['X', 'Y', 'Z']
    window_size = 2

    # Define separate thresholds for each column
    thresholds = {
        'X': 100,
        'Y': 100,
        'Z': 110
    }

    results = {}
    all_means_greater_than_100 = True
    all_columns_exceed_threshold = True

    for col in columns_to_calculate:
        # Calculate rolling standard deviation
        rolling_std = df[col].rolling(window=window_size).std()

        # Drop NaN values created by rolling window calculation
        rolling_std = rolling_std.dropna()

        # Calculate the mean of the rolling standard deviation
        mean_rolling_std = rolling_std.mean()

        # Check if the mean exceeds the general threshold of 100
        if mean_rolling_std <= 100:
            all_means_greater_than_100 = False

        # Check if the mean exceeds the column-specific threshold
        if mean_rolling_std <= thresholds[col]:
            all_columns_exceed_threshold = False

        # Store the results
        results[col] = {
            'mean_rolling_std': mean_rolling_std,
            'exceeds_threshold': mean_rolling_std > thresholds[col]
        }

    # Print leak detection status based on combined criteria
    if all_means_greater_than_100 and all_columns_exceed_threshold:
        print(f"Leak detected between data points {start_idx + 1} and {end_idx} due to high rolling std deviations in all columns.")
    else:
        print(f"No leak detected between data points {start_idx + 1} and {end_idx}.")

    # Print detailed results for each column
    for col, result in results.items():
        print(f"Column: {col}")
        print(f"  mean_rolling_std: {result['mean_rolling_std']}")
        print(f"  Exceeds Threshold: {'Yes' if result['exceeds_threshold'] else 'No'}")
        print()

    return results


def monitor_file(file_path, output_path):
    last_size = 0
    # print("Monitoring the file for new lines...")

    while True:
        try:
            current_size = os.stat(file_path).st_size
            if current_size > last_size:
                with open(file_path, 'r') as file:
                    file.seek(last_size)
                    new_lines = file.readlines()
                    last_size = current_size
                    process_data_in_real_time(new_lines, output_path)
            time.sleep(1)
        except FileNotFoundError:
            print("Input file not found. Retrying...")
            time.sleep(2)


def string_to_dataframe(input_string):
    """
    Converts a space-separated string of numbers into a Pandas DataFrame.
    
    Args:
        input_string (str): The input string with rows of space-separated numbers.
        
    Returns:
        pd.DataFrame: DataFrame with each row and column parsed from the input string.
    """
   # Use StringIO to treat the string as a file-like object
    data = StringIO(input_string)
    
    # Use pandas read_csv with sep='\s+' as delimiter (using raw string to avoid escape sequence warning)
    df = pd.read_csv(data, sep=r'\s+', header=None)
    df.columns = ['X', 'Y', 'Z']

    
    return df

def do(lines, start_idx=0, end_idx=99):
    df = string_to_dataframe(lines)
    # print(df)
    columns_to_calculate = ['X', 'Y', 'Z']
    window_size = 2

    # Define separate thresholds for each column
    thresholds = {
        'X': 100,
        'Y': 100,
        'Z': 110
    }

    results = {}
    all_means_greater_than_100 = True
    all_columns_exceed_threshold = True

    for col in columns_to_calculate:
        # Calculate rolling standard deviation
        rolling_std = df[col].rolling(window=window_size).std()

        # Drop NaN values created by rolling window calculation
        rolling_std = rolling_std.dropna()

        # Calculate the mean of the rolling standard deviation
        mean_rolling_std = rolling_std.mean()

        # Check if the mean exceeds the general threshold of 100
        if mean_rolling_std <= 100:
            all_means_greater_than_100 = False

        # Check if the mean exceeds the column-specific threshold
        if mean_rolling_std <= thresholds[col]:
            all_columns_exceed_threshold = False

        # Store the results
        results[col] = {
            'mean_rolling_std': mean_rolling_std,
            'exceeds_threshold': mean_rolling_std > thresholds[col]
        }

    # Determine leak detection status
    if all_means_greater_than_100 and all_columns_exceed_threshold:
        detection_status = 1
        message = f"Leak detected between data points {start_idx + 1} and {end_idx} due to high rolling std deviations in all columns."
    else:
        detection_status = 0
        message = f"No leak detected between data points {start_idx + 1} and {end_idx}."

    # Print detailed results for each column
    # for col, result in results.items():
        # print(f"Column: {col}")
        # print(f"  mean_rolling_std: {result['mean_rolling_std']}")
        # print(f"  Exceeds Threshold: {'Yes' if result['exceeds_threshold'] else 'No'}")
        # print()

    # Return detection status and message
    return detection_status


def dist(sensortype,lines):
    if sensortype=='K':
        df = string_to_dataframe(lines)
        # print(df)
        columns_to_calculate = ['X', 'Y', 'Z']
        window_size = 2

        # Define separate thresholds for each column
        thresholds = {
            'X': 100,
            'Y': 100,
            'Z': 110
        }

        results = {}
        all_means_greater_than_100 = True
        all_columns_exceed_threshold = True
        mean_rolling_std = [0,0,0]
        i = 0 

        for col in columns_to_calculate:
            # Calculate rolling standard deviation
            rolling_std = df[col].rolling(window=window_size).std()

            # Drop NaN values created by rolling window calculation
            rolling_std = rolling_std.dropna()

            # Calculate the mean of the rolling standard deviation
            mean_rolling_std[i] = rolling_std.mean()

            # Check if the mean exceeds the general threshold of 100
            if mean_rolling_std[i] <= 100:
                all_means_greater_than_100 = False

            # Check if the mean exceeds the column-specific threshold
            if mean_rolling_std[i] <= thresholds[col]:
                all_columns_exceed_threshold = False

            # Store the results
            results[col] = {
                'mean_rolling_std': mean_rolling_std[i],
                'exceeds_threshold': mean_rolling_std[i] > thresholds[col]
            }
        distance = [0,0,0]
        if mean_rolling_std[0]>=100 and mean_rolling_std[0]<=150:
            distance[0] = 15
        elif mean_rolling_std[0]>=150 and mean_rolling_std[0]<=200:
            distance[0] = 25
        else:
            distance[0] = 0

        if mean_rolling_std[1]>=100 and mean_rolling_std[1]<=150:
            distance[1] = 15
        elif mean_rolling_std[1]>=150 and mean_rolling_std[1]<=200:
            distance[1] = 25
        else:
            distance[1] = 0

        if mean_rolling_std[2]>=100 and mean_rolling_std[2]<=150:
            distance[2] = 15
        elif mean_rolling_std[2]>=150 and mean_rolling_std[2]<=200:
            distance[2] = 25
        else:
            distance[2] = 0


        # Determine leak detection status
        # if all_means_greater_than_100 and all_columns_exceed_threshold:
            # detection_status = 1
            # message = f"Leak detected between data points {start_idx + 1} and {end_idx} due to high rolling std deviations in all columns."
        # else:
            # detection_status = 0
            # message = f"No leak detected between data points {start_idx + 1} and {end_idx}."

        # Print detailed results for each column
        # for col, result in results.items():
            # print(f"Column: {col}")
            # print(f"  mean_rolling_std: {result['mean_rolling_std']}")
            # print(f"  Exceeds Threshold: {'Yes' if result['exceeds_threshold'] else 'No'}")
            # print()

        # Return detection status and message
        return distance
    if sensortype == "A":
        df = string_to_dataframe(lines)
        # print(df)
        columns_to_calculate = ['X', 'Y', 'Z']
        window_size = 2

        # Define separate thresholds for each column
        thresholds = {
            'X': 800,
            'Y': 800,
            'Z': 400
        }

        results = {}
        all_means_greater_than_100 = True
        all_columns_exceed_threshold = True
        mean_rolling_std = [0,0,0]
        i = 0 

        for col in columns_to_calculate:
            # Calculate rolling standard deviation
            rolling_std = df[col].rolling(window=window_size).std()

            # Drop NaN values created by rolling window calculation
            rolling_std = rolling_std.dropna()

            # Calculate the mean of the rolling standard deviation
            mean_rolling_std[i] = rolling_std.mean()

            # Check if the mean exceeds the general threshold of 100
            if mean_rolling_std[i] <= 100:
                all_means_greater_than_100 = False

            # Check if the mean exceeds the column-specific threshold
            if mean_rolling_std[i] <= thresholds[col]:
                all_columns_exceed_threshold = False

            # Store the results
            results[col] = {
                'mean_rolling_std': mean_rolling_std[i],
                'exceeds_threshold': mean_rolling_std[i] > thresholds[col]
            }
        distance = [0,0,0]
        if mean_rolling_std[0]>=100 and mean_rolling_std[0]<=150:
            distance[0] = 15
        elif mean_rolling_std[0]>=150 and mean_rolling_std[0]<=200:
            distance[0] = 25
        else:
            distance[0] = 0

        if mean_rolling_std[1]>=100 and mean_rolling_std[1]<=150:
            distance[1] = 15
        elif mean_rolling_std[1]>=150 and mean_rolling_std[1]<=200:
            distance[1] = 25
        else:
            distance[1] = 0

        if mean_rolling_std[2]>=100 and mean_rolling_std[2]<=150:
            distance[2] = 15
        elif mean_rolling_std[2]>=150 and mean_rolling_std[2]<=200:
            distance[2] = 25
        else:
            distance[2] = 0


        # Determine leak detection status
        # if all_means_greater_than_100 and all_columns_exceed_threshold:
            # detection_status = 1
            # message = f"Leak detected between data points {start_idx + 1} and {end_idx} due to high rolling std deviations in all columns."
        # else:
            # detection_status = 0
            # message = f"No leak detected between data points {start_idx + 1} and {end_idx}."

        # Print detailed results for each column
        # for col, result in results.items():
            # print(f"Column: {col}")
            # print(f"  mean_rolling_std: {result['mean_rolling_std']}")
            # print(f"  Exceeds Threshold: {'Yes' if result['exceeds_threshold'] else 'No'}")
            # print()

        # Return detection status and message
        return distance



if __name__ == "__main__":
    import sys
    
    arg1 = sys.argv[1]  # Get argument passed from Node.js\
    arg2 = sys.argv[2]  # Get argument passed from Node.js\
    # arg2 = "-1324 960 16623\n-1463 805 16524\n-1354 821 16689s\n-1403 876 16562s\n-1415 853 16470s\n-1527 822 16503s\n-1238 693 16616s\n-1527 873 16310s\n-1471 1098 16573s\n-1396 836 16685s\n-1549 807 16569s\n-1438 737 16479s\n-1500 743 16559s\n-1418 823 16483"
    # arg3 = "-1381 822 16775\n-1576 618 16455\n-1402 775 16573\n-1509 720 16528\n-1384 773 16507\n-1418 858 16425\n-1453 804 16491\n-1441 809 16536\n-1381 822 16775\n-1576 618 16455\n-1402 775 16573\n-1509 720 16528\n-1384 773 16507\n-1418 858 16425\n-1381 822 16775\n-1576 618 16455\n-1402 775 16573\n-1509 720 16528\n-1384 773 16507\n-1381 822 16775\n-1576 618 16455\n-1402 775 16573\n-1509 720 16528\n-1381 822 16775\n-1576 618 16455\n-1402 775 16573\n-1381 822 16775\n-1576 618 16455\n-1381 822 16775\n-1576 618 16455\n-1381 822 16775\n-1576 618 16455\n-1402 775 16573\n-1509 720 16528\n-1381 822 16775\n-1576 618 16455\n-1402 775 16573\n-1509 720 16528\n-1384 773 16507\n-1418 858 16425\n-1453 804 16491\n-1381 822 16775\n-1576 618 16455\n-1402 775 16573\n-1509 720 16528\n-1384 773 16507\n-1418 858 16425\n-1381 822 16775\n-1576 618 16455\n-1402 775 16573\n-1509 720 16528\n-1384 773 16507\n-1418 858 16425\n-1576 618 16455\n-1402 775 16573\n-1509 720 16528\n-1402 775 16573\n-1509 720 16528\n-1384 773 16507\n-1509 720 16528\n-1384 773 16507\n-1384 773 16507\n-1418 858 16425\n-1453 804 16491\n-1441 809 16536"
    print(dist(arg1,arg2))
    # print(string_to_dataframe(arg2))


