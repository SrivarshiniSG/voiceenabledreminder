import React, { useState, useEffect } from 'react';
import './MedicationReminder.css';
import { useAuth } from '../context/AuthContext';

const MedicationReminder = () => {
  const { user, logout } = useAuth();

  const [medications, setMedications] = useState(() => {
    const saved = localStorage.getItem(`medications_${user.id}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [emergencyContact, setEmergencyContact] = useState(() => {
    const saved = localStorage.getItem(`emergency_${user.id}`);
    return saved ? JSON.parse(saved) : { name: '', phone: '' };
  });
  const [notifications, setNotifications] = useState([]);
  const [voiceReminders, setVoiceReminders] = useState({});

  const [newMed, setNewMed] = useState({
    name: '',
    times: [],
    frequency: '1',
    customTimes: ['09:00'],
  });

  useEffect(() => {
    if (user && user.id) {
      localStorage.setItem(`medications_${user.id}`, JSON.stringify(medications));
    }
  }, [medications, user]);

  useEffect(() => {
    if (user && user.id) {
      localStorage.setItem(`emergency_${user.id}`, JSON.stringify(emergencyContact));
    }
  }, [emergencyContact, user]);

  const formatTime = (time) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleTimeChange = (index, value) => {
    const updatedTimes = [...newMed.customTimes];
    updatedTimes[index] = value;
    setNewMed({ ...newMed, customTimes: updatedTimes });
  };

  const handleFrequencyChange = (e) => {
    const frequency = e.target.value;
    const numberOfTimes = parseInt(frequency);
    const defaultTimes = Array(numberOfTimes).fill('09:00');
    setNewMed({
      ...newMed,
      frequency,
      customTimes: defaultTimes,
    });
  };

  const handleAddMedication = (e) => {
    e.preventDefault();
    if (newMed.name.trim()) {
      setMedications([
        ...medications,
        {
          ...newMed,
          times: newMed.customTimes,
          id: Date.now(),
        },
      ]);
      setNewMed({
        name: '',
        times: [],
        frequency: '1',
        customTimes: ['09:00'],
      });
    }
  };

  const handleDelete = (id) => {
    setMedications(medications.filter((med) => med.id !== id));
  };

  const playVoiceNotification = (medicationName) => {
    const speech = new SpeechSynthesisUtterance(
      `Reminder: Please take your medication ${medicationName}. Click the Mark as Taken button when you have taken it.`
    );
    window.speechSynthesis.speak(speech);
  };

  const createNotification = (medication, time) => {
    const notificationId = Date.now();
    const newNotification = {
      id: notificationId,
      medication,
      time,
      created: new Date(),
    };
    setNotifications((prev) => [...prev, newNotification]);
    const voiceInterval = setInterval(() => {
      playVoiceNotification(medication);
    }, 2 * 60 * 1000);
    setVoiceReminders((prev) => ({
      ...prev,
      [notificationId]: voiceInterval,
    }));
    setTimeout(() => {
      setNotifications((currentNotifications) => {
        const notificationExists = currentNotifications.find(
          (n) => n.id === notificationId
        );

        if (notificationExists) {
          forwardToEmergencyContact(medication, time);
          return currentNotifications.filter((n) => n.id !== notificationId);
        }
        return currentNotifications;
      });
    }, 5 * 60 * 1000);
    playVoiceNotification(medication);
    return newNotification;
  };

  const acknowledgeNotification = (notificationId) => {
    if (voiceReminders[notificationId]) {
      clearInterval(voiceReminders[notificationId]);
      setVoiceReminders((prev) => {
        const updated = { ...prev };
        delete updated[notificationId];
        return updated;
      });
    }
    setNotifications((prevNotifications) =>
      prevNotifications.filter((notif) => notif.id !== notificationId)
    );
    const speech = new SpeechSynthesisUtterance('Thank you for taking your medication!');
    window.speechSynthesis.speak(speech);
  };

  const forwardToEmergencyContact = async (medication, time) => {
    if (!emergencyContact.phone) return;
    try {
      const response = await fetch('/api/send-emergency-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: emergencyContact.phone,
          message: `ALERT: ${medication} was scheduled for ${time} but hasn't been taken.`,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to send emergency notification');
      }
    } catch (error) {
      console.error('Error sending emergency notification:', error);
      alert('Failed to send emergency notification');
    }
  };

  useEffect(() => {
    return () => {
      Object.values(voiceReminders).forEach((intervalId) => {
        clearInterval(intervalId);
      });
    };
  }, [voiceReminders]);

  useEffect(() => {
    const checkMedications = setInterval(() => {
      const now = new Date();
      const currentTime = now.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });

      medications.forEach((med) => {
        med.times.forEach((time) => {
          const medTime = new Date(`2000-01-01T${time}`).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
          });
          if (currentTime === medTime) {
            const notification = createNotification(med.name, time);

            if ('Notification' in window) {
              if (Notification.permission === 'granted') {
                const browserNotif = new Notification(`Time to take ${med.name}!`, {
                  body: 'Click to acknowledge',
                  requireInteraction: true,
                });

                browserNotif.onclick = () => acknowledgeNotification(notification.id);
              } else if (Notification.permission !== 'denied') {
                Notification.requestPermission();
              }
            }

            const speech = new SpeechSynthesisUtterance(`Time to take ${med.name}!`);
            window.speechSynthesis.speak(speech);
          }
        });
      });
    }, 30000);

    return () => clearInterval(checkMedications);
  }, [medications]);

  return (
    <div className="medication-reminder">
      <div className="header-container">
        <h2>Medication Reminder</h2>
        <div className="user-info">
          <div className="user-profile">
            <span className="user-icon">👤</span>
            <span className="user-name">{user.name}</span>
          </div>
          <button className="logout-button" onClick={logout}>
            Logout
          </button>
        </div>
      </div>

      <div className="emergency-contact-form">
        <h3>Emergency Contact</h3>
        <div className="form-group">
          <label>Contact Name</label>
          <input
            type="text"
            value={emergencyContact.name}
            onChange={(e) =>
              setEmergencyContact({
                ...emergencyContact,
                name: e.target.value,
              })
            }
            placeholder="Emergency contact name"
          />
        </div>
        <div className="form-group">
          <label>Contact Phone</label>
          <input
            type="tel"
            value={emergencyContact.phone}
            onChange={(e) =>
              setEmergencyContact({
                ...emergencyContact,
                phone: e.target.value,
              })
            }
            placeholder="Emergency contact phone"
          />
        </div>
      </div>

      {notifications.length > 0 && (
        <div className="active-notifications">
          <h3>Active Notifications</h3>
          {notifications.map((notif) => (
            <div key={notif.id} className="notification-item">
              <p>Take {notif.medication} (Scheduled for {formatTime(notif.time)})</p>
              <button
                className="acknowledge-button"
                onClick={() => acknowledgeNotification(notif.id)}
              >
                Mark as Taken
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAddMedication} className="add-medication-form">
        <div className="form-group">
          <label>Medication Name</label>
          <input
            type="text"
            placeholder="Enter medication name"
            value={newMed.name}
            onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label>Frequency</label>
          <select value={newMed.frequency} onChange={handleFrequencyChange}>
            <option value="1">Once daily</option>
            <option value="2">Twice daily</option>
            <option value="3">Three times daily</option>
          </select>
        </div>

        <div className="form-group">
          <label>Set Times</label>
          {newMed.customTimes.map((time, index) => (
            <input
              key={index}
              type="time"
              value={time}
              onChange={(e) => handleTimeChange(index, e.target.value)}
              className="time-input"
            />
          ))}
        </div>

        <button type="submit">Add Medication</button>
      </form>

      <div className="medications-list">
        <h3>Your Medications</h3>
        {medications.map((med) => (
          <div key={med.id} className="medication-item">
            <h4>{med.name}</h4>
            <p>Times: {med.times.map(formatTime).join(', ')}</p>
            <button className="delete-button" onClick={() => handleDelete(med.id)}>
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MedicationReminder;
