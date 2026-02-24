import numpy as np
import pandas as pd
from sklearn.preprocessing import MinMaxScaler
from sklearn.model_selection import train_test_split
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping
import joblib

# ==============================================
# 1. SYNTHETIC DATASET GENERATION (Login + Token)
# ==============================================

def generate_dataset(n_samples=3000):
    data = []
    labels = []

    for _ in range(n_samples):

        # ---------------- Normal Behavior (80%) ----------------
        if np.random.rand() > 0.2:  
            time_gap = np.random.randint(30, 600)         
            ip_change = 0
            loc_change = 0
            request_rate = np.random.randint(1, 8)
            device_change = 0

            token_age = np.random.randint(10, 3600)  
            token_ip_change = 0
            token_loc_change = 0
            token_use_time_gap = np.random.randint(10, 600)
            token_request_rate = np.random.randint(1, 10)
            token_validity_remaining = np.random.randint(300, 3600)  
            signature_valid = 1

            anomaly = 0

        # ---------------- Anomalous Behavior (20%) ----------------
        else:
            time_gap = np.random.randint(1, 20)
            ip_change = np.random.choice([0,1])
            loc_change = np.random.choice([0,1])
            request_rate = np.random.randint(10, 50)
            device_change = np.random.choice([0,1])

            token_age = np.random.randint(1, 2000)
            token_ip_change = np.random.choice([0,1])
            token_loc_change = np.random.choice([0,1])
            token_use_time_gap = np.random.randint(1, 20)
            token_request_rate = np.random.randint(20, 100)
            token_validity_remaining = np.random.randint(1, 200)
            signature_valid = np.random.choice([0,1], p=[0.4, 0.6])

            anomaly = 1

        # Combine all 12 features
        row = [
            time_gap, ip_change, loc_change, request_rate, device_change,
            token_age, token_ip_change, token_loc_change, token_use_time_gap,
            token_request_rate, token_validity_remaining, signature_valid
        ]

        data.append(row)
        labels.append(anomaly)

    df = pd.DataFrame(data, columns=[
        "time_gap", "ip_change", "loc_change", "request_rate", "device_change",
        "token_age", "token_ip_change", "token_loc_change", "token_use_time_gap",
        "token_request_rate", "token_validity_remaining", "signature_valid"
    ])
    df["label"] = labels

    return df


print("Generating synthetic login+token dataset...")
df = generate_dataset(3000)
print(df.head())


# ==============================================
# 2. PREPROCESSING & NORMALIZATION
# ==============================================

feature_columns = [
    "time_gap", "ip_change", "loc_change", "request_rate", "device_change",
    "token_age", "token_ip_change", "token_loc_change", "token_use_time_gap",
    "token_request_rate", "token_validity_remaining", "signature_valid"
]

features = df[feature_columns].values
labels = df["label"].values

scaler = MinMaxScaler()
features_scaled = scaler.fit_transform(features)

# LSTM input format: (samples, timesteps, features)
features_scaled = features_scaled.reshape((features_scaled.shape[0], 1, 12))

x_train, x_test, y_train, y_test = train_test_split(features_scaled, labels, test_size=0.2, random_state=42)


# ==============================================
# 3. BUILD THE LSTM MODEL (updated input size: 12)
# ==============================================

model = Sequential([
    LSTM(64, activation='tanh', return_sequences=True, input_shape=(1, 12)),
    Dropout(0.2),
    LSTM(32, activation='tanh'),
    Dropout(0.2),
    Dense(16, activation='relu'),
    Dense(1, activation='sigmoid')
])

model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])

model.summary()


# ==============================================
# 4. TRAIN THE MODEL
# ==============================================

print("\nTraining LSTM model...")
early_stop = EarlyStopping(monitor="val_loss", patience=3, restore_best_weights=True)

history = model.fit(
    x_train, y_train,
    epochs=25,
    batch_size=32,
    validation_split=0.2,
    callbacks=[early_stop],
    verbose=1
)


# ==============================================
# 5. EVALUATE THE MODEL
# ==============================================

loss, accuracy = model.evaluate(x_test, y_test, verbose=0)

print("\n========================")
print(" Evaluation Results")
print("========================")
print(f"Accuracy: {accuracy * 100:.2f}%")
print(f"Loss: {loss:.4f}")


# ==============================================
# 6. SAVE MODEL + SCALER
# ==============================================

model.save("/kaggle/working/vaultid_lstm_token_model.keras")
print("\nModel saved: vaultid_lstm_token_model.keras")

joblib.dump(scaler, "/kaggle/working/token_scaler.pkl")
print("Scaler saved: token_scaler.pkl")
