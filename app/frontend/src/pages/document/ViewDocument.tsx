import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { BlobUrlResponse, getBlobUrl } from "../../api"
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';

import styles from "./ViewDocument.module.css";

const ViewDocument = () => {
    const location = useLocation();
    const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined);
    const [error, setError] = useState<string | undefined>(undefined);
    const queryParams = new URLSearchParams(location.search);

    const iframeHeight: string = "760px";

    // Extract documentName and pageNumber from the query string
    const documentName = queryParams.get("documentName") || "";
    const documentExt: any = documentName?.split(".").pop();
    const pageNumber = queryParams.get("pageNumber") || 1;

    async function fetchBlobUrl() {
        try {
            const response: BlobUrlResponse = await getBlobUrl(documentName)
            if (response.error) {
                setError(response.error);

            } else {
                setBlobUrl(response.url);
            }

        } catch (error) {
            setError("An unexpected error occurred while fetching the document.");
            console.log(error);
        }
    };

    useEffect(() => {
        fetchBlobUrl();
    }, [documentName]);

    // Render error message if there's an error
    if (error) {
        return <div className={styles.error}>Error: {error}</div>;
    }

    const viewer = blobUrl === undefined ? (
        <Spinner size={SpinnerSize.large} label="Loading..." />
    ) : (
        documentExt === "pdf" ? (
            <object data={blobUrl + "#page=" + pageNumber} type="application/pdf" width="100%" height={iframeHeight} />
        ) : documentExt === "docx" ? (
            <iframe
                title="Source File"
                src={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(blobUrl as string)}&action=embedview&wdStartOn=${pageNumber}`}
                width="100%"
                height={iframeHeight}
            />
        ) : documentExt === "xlsx" ? (
            <iframe
                title="Source File"
                src={`https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(blobUrl as string)}&action=embedview`}
                width="100%"
                height={iframeHeight}
            />
        ) : (
            <iframe title="Source File" src={blobUrl} width="100%" height={iframeHeight} />
        )
    );

    return <div className={styles.docViewer}>{viewer}</div>;
};

export default ViewDocument;