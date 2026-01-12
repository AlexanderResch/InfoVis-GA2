import pandas as pd

input_file = "openpowerlifting-dataset.csv"

output_file = "openpowerlifting_subset.csv"

print("Loading CSV...")

df = pd.read_csv(input_file, usecols=[
    "Name",
    "Sex",
    "Equipment",
    "Age",
    "Division",
    "BodyweightKg",
    "WeightClassKg",
    "Best3SquatKg",
    "Best3BenchKg",
    "Best3DeadliftKg",
    "TotalKg",
    "Dots",
    "Tested",
    "Country",
    "State",
    "Federation",
    "Date"
])

print("Rows loaded:", len(df))
print("Saving subset...")


df.to_csv(output_file, index=False)

print("Saved as:", output_file)