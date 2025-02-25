import React from 'react';
import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton } from '@ionic/react';
import { useHistory } from 'react-router-dom';

const Dashboard: React.FC = () => {
  // Safely retrieve user data from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const history = useHistory();

  const handleLogout = () => {
    localStorage.removeItem('user'); // Clear user data
    history.push('/home'); // Redirect to the login page
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Dashboard</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <h1>Welcome, {user.email}!</h1>
        <p>You are now logged in.</p>
        <IonButton expand="full" onClick={handleLogout}>
          Logout
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default Dashboard;