import subprocess

def run_terminal_command(command):
    try:
        # Run the command and wait for it to complete
        result = subprocess.run(command, shell=True, check=True, text=True, capture_output=True)
        print("Command output:", result.stdout)
    except subprocess.CalledProcessError as e:
        print("Command failed with error:", e.stderr)

if __name__ == "__main__":
    # Replace 'your_command_here' with the actual command you want to run
    command = "npm start"  # Example command: list files in the current directory
    print('server started...')
    run_terminal_command(command)
