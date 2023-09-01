import { useEffect, useState } from "react";
import { Label, Text } from "@fluentui/react";
import { getUserData, GetUserResponse } from "../../api";

interface Props {
    className?: string;
}

export const UserInfo = ({ className }: Props) => {
    const [userData, setUserData] = useState<GetUserResponse | null>(null);

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
        <div className={`${className ?? ""}`}>
            <h6>Session Information</h6>
            <Label>User ID</Label>
            <Text> {userData?.id}</Text>
            <Label>Session ID</Label>
            <Text> {userData?.session_id}</Text>
            <Label>Username</Label>
            <Text> {userData?.userPrincipalName}</Text>
        </div>
    );
};