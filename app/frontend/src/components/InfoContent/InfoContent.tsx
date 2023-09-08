// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import React, { useEffect, useState } from "react";
import { Text } from "@fluentui/react";
import { Label } from '@fluentui/react/lib/Label';
import { Separator } from '@fluentui/react/lib/Separator';
import { getInfoData, GetInfoResponse, getUserData, GetUserResponse  } from "../../api";
import styles from "./InfoContent.module.css"

interface Props {
    className?: string;
}

export const InfoContent = ({ className }: Props) => {
    const [infoData, setInfoData] = useState<GetInfoResponse | null>(null);
    const [userData, setUserData] = useState<GetUserResponse | null>(null);

    async function fetchInfoData() {
        console.log("InfoContent 1");
        try {
            const fetchedInfoData = await getInfoData();
            setInfoData(fetchedInfoData);
        } catch (error) {
            // Handle the error here
            console.log(error);
        }
    }

    useEffect(() => {
        fetchInfoData();
    }, []);

    async function fetchUserData() {
        try {
            const fetcheduserData = await getUserData();
            setUserData(fetcheduserData);
        } catch (error) {
            console.log(error);
        }
    }

    useEffect(() => {
        fetchUserData();
    }, []);

    return (
        <div>
            <Separator className={styles.separator}>Azure OpenAI</Separator>
            <Label>Instance</Label><Text>{infoData?.AZURE_OPENAI_SERVICE}</Text>
            <Label>Deployment Name</Label><Text>{infoData?.AZURE_OPENAI_CHATGPT_DEPLOYMENT}</Text>
            <Label>Model Name</Label><Text>{infoData?.AZURE_OPENAI_MODEL_NAME}</Text>
            <Label>Model Version</Label><Text>{infoData?.AZURE_OPENAI_MODEL_VERSION}</Text>

            <Separator className={styles.separator}>Azure Cognitive Search</Separator>
            <Label>Service Name</Label><Text>{infoData?.AZURE_SEARCH_SERVICE}</Text>
            <Label>Index Name</Label><Text>{infoData?.AZURE_SEARCH_INDEX}</Text>

            <Separator className={styles.separator}>System Configuration</Separator>
            <Label>System Language</Label><Text>{infoData?.TARGET_LANGUAGE}</Text>

            <Separator className={styles.separator}>Session Information</Separator>
            <Label>User ID</Label><Text> {userData?.id}</Text>
            <Label>Session ID</Label><Text> {userData?.session_id}</Text>
            <Label>Username</Label><Text> {userData?.userPrincipalName}</Text>
        </div>
    );
};