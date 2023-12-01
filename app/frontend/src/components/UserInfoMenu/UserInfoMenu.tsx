import { useRef, useEffect, useState } from "react";
import { ContextualMenu, Persona, PersonaSize, PersonaInitialsColor, IContextualMenuItem } from '@fluentui/react';
import { getUserData, UserData } from '../../api'

import styles from "./UserInfoMenu.module.css";

interface Props { }

export const UserInfoMenu = ({ }: Props) => {
    const [userData, setUserData] = useState<UserData | null>(null);
    const [showContextMenu, setShowContextMenu] = useState(false);
    const personaRef = useRef(null);

    const onPersonaClick = (ev: React.MouseEvent<HTMLElement>) => {
        ev.preventDefault();
        setShowContextMenu(true);
    };

    const onHideContextMenu = () => {
        setShowContextMenu(false);
    };

    async function fetchUserData() {
        try {
            const data: UserData = await getUserData();
            setUserData(data);
        } catch (error) {
            console.log(error);
        }
    }

    useEffect(() => {
        fetchUserData();
    }, []);

    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        onHideContextMenu();
    };

    const menuItems: IContextualMenuItem[] = [
        {
            key: 'logout',
            iconProps: { iconName: 'SignOut' },
            text: 'Logout',
            href: "/logout",
            className: styles.menuItem
        },
        {
            key: 'copySessionInfoToClipboard',
            iconProps: { iconName: 'Copy' },
            text: 'Copy Session Info to Clipboard',
            onClick: () => handleCopyToClipboard(`User ID: ${userData?.id}\nSession ID: ${userData?.session_id}`),
        },
    ];

    return (
        <div>
            {userData && (
                <>
                    <Persona
                        className={styles.persona}
                        text={userData.displayName}
                        imageUrl={userData.base64_image ? `data:image/png;base64, ${userData.base64_image}` : undefined}
                        size={PersonaSize.size48}
                        initialsColor={PersonaInitialsColor.blue}
                        onClick={onPersonaClick}
                        ref={personaRef}
                    />
                    <ContextualMenu
                        items={menuItems}
                        hidden={!showContextMenu}
                        target={personaRef}
                        onItemClick={onHideContextMenu}
                        onDismiss={onHideContextMenu}
                    />
                </>
            )}
        </div>
    );
};
