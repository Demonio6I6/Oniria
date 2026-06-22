import React, { createContext, useState, useEffect } from 'react';
import { createEmptyProfileResponses } from './domain/profile';
import {
  loadProfileResponses,
  saveProfileResponses,
} from './services/profileRepository';

export const GlobalContext = createContext();

export const GlobalProvider = ({ children, userId }) => {
  const [respuestas, setRespuestas] = useState(createEmptyProfileResponses);
  const [profileLoaded, setProfileLoaded] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadRespuestas = async () => {
      setProfileLoaded(false);

      if (!userId) {
        setRespuestas(createEmptyProfileResponses());
        setProfileLoaded(true);
        return;
      }

      try {
        const respuestasGuardadas = await loadProfileResponses();
        if (isActive) {
          setRespuestas(respuestasGuardadas);
        }
      } catch (error) {
        console.log('Error cargando respuestas:', error);
      } finally {
        if (isActive) {
          setProfileLoaded(true);
        }
      }
    };

    loadRespuestas();

    return () => {
      isActive = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!profileLoaded || !userId) return;

    const saveRespuestas = async () => {
      try {
        await saveProfileResponses(respuestas);
      } catch (error) {
        console.log('Error guardando respuestas:', error);
      }
    };

    saveRespuestas();
  }, [respuestas, profileLoaded, userId]);

  const updateRespuestas = (newRespuestas) => {
    setRespuestas(newRespuestas);
  };

  const clearRespuestas = () => {
    setRespuestas(createEmptyProfileResponses());
  };

  return (
    <GlobalContext.Provider value={{ respuestas, updateRespuestas, clearRespuestas }}>
      {children}
    </GlobalContext.Provider>
  );
};
