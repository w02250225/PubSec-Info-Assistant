import React, { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { Spinner, SpinnerSize } from '@fluentui/react';
import { getUserData, UserData } from '../../api'
import styles from "./UserContent.module.css";
import Coeus from "../../assets/coeus.png";

interface UserContextType {
    userData: UserData | null;
    setUserData: React.Dispatch<React.SetStateAction<UserData | null>>;
}

export const UserContext = createContext<UserContextType | null>(null);

export const UserProvider = ({ children }: { children: ReactNode }) => {
    const [userData, setUserData] = useState<UserData | null>(null);

    async function fetchUserData() {
        try {
            const data: UserData = await getUserData();
            setUserData(data);
        } catch (error) {
            console.log(error);
        }
    };

    useEffect(() => {
        fetchUserData();
    }, []);

    if (!userData) {
        return (
            <div className={styles.container}>
                <img src={Coeus} className={styles.chatLogo} />
                <div className={styles.spinnerContainer}>
                    <Spinner size={SpinnerSize.large} label="Loading application..." ariaLive="assertive" labelPosition="right" />
                </div>
            </div>
        );
    }

    return (
        <UserContext.Provider value={{ userData, setUserData }}>
            {children}
        </UserContext.Provider>
    );
};