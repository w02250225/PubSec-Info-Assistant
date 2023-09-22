import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getBlobUrl } from "../../api"
import { Spinner } from '@fluentui/react-components';

import styles from "./ViewDocument.module.css";

const ViewDocument = () => {
    const location = useLocation();
    const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined);
    const queryParams = new URLSearchParams(location.search);

    const iframeHeight: string = "760px";

    // Extract documentName and pageNumber from the query string
    const documentName = queryParams.get("documentName") || "";
    const documentExt: any = documentName?.split(".").pop();
    const pageNumber = queryParams.get("pageNumber") || 1;

    async function fetchBlobUrl() {
        try {
            const url = await getBlobUrl(documentName)
            setBlobUrl(url);
        } catch (error) {
            // Handle the error here
            console.log(error);
        }
    }

    useEffect(() => {
        fetchBlobUrl();
    }, [documentName]);


    const viewer = blobUrl === undefined ? (
        <Spinner size="huge" label="Loading..." />
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