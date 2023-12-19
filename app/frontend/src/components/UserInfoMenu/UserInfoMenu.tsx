import { useRef, useEffect, useState } from "react";
import { ContextualMenu, Persona, PersonaSize, PersonaInitialsColor, IContextualMenuItem } from '@fluentui/react';
import { UserData } from '../../api'

import styles from "./UserInfoMenu.module.css";

interface Props { 
    userData: UserData;
}

export const UserInfoMenu = ({ userData }: Props) => {
    const [showContextMenu, setShowContextMenu] = useState(false);
    const personaRef = useRef(null);

    const onPersonaClick = (ev: React.MouseEvent<HTMLElement>) => {
        ev.preventDefault();
        setShowContextMenu(true);
    };

    const onHideContextMenu = () => {
        setShowContextMenu(false);
    };

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
            onClick: () => handleCopyToClipboard(`User ID: ${userData.user_id}\nSession ID: ${userData.session_id}`),
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
