// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import { renderToStaticMarkup } from "react-dom/server";
import { getCitationFilePath } from "../../api";

type HtmlParsedAnswer = {
    answerHtml: string;
    citations: string[];
    sourceFiles: Record<string, string>;
    pageNumbers: Record<string, number>;
};

type CitationLookup = Record<string, {
    citation: string;
    source_path: string;
    page_number: string;
}>;


export function parseAnswerToHtml(answer: string, isStreaming: boolean, citation_lookup: CitationLookup): HtmlParsedAnswer {

    const citations: string[] = [];
    const sourceFiles: Record<string, string> = {};
    const pageNumbers: Record<string, number> = {};

    let parsedAnswer = answer.trim();

    const hasCitations = Object.keys(citation_lookup).length > 0;

    // if there are no citations, just return the parsedAnswer
    if (!hasCitations) {
        return {
            answerHtml: parsedAnswer,
            citations,
            sourceFiles,
            pageNumbers
        };
    }
    else {
        if (isStreaming) { // Omit a citation that is still being typed during streaming
            let lastIndex = parsedAnswer.length;
            for (let i = parsedAnswer.length - 1; i >= 0; i--) {
                if (parsedAnswer[i] === "]") {
                    break;
                } else if (parsedAnswer[i] === "[") {
                    lastIndex = i;
                    break;
                }
            }
            const truncatedAnswer = parsedAnswer.substring(0, lastIndex);
            parsedAnswer = truncatedAnswer;
        }

        // Split the answer into parts, where the odd parts are citations
        const parts = parsedAnswer.split(/\[([^\]]+)\]/g);

        const fragments: string[] = parts.map((part, index) => {
            if (index % 2 === 0) {
                // Even parts are just text
                return part;
            } else {
                // Odd parts are citations as the "FileX" moniker
                const citation = citation_lookup[part];

                if (!citation) {
                    // if the citation reference provided by the OpenAI response does not match a key in the citation_lookup object
                    // then return an empty string to avoid a crash or blank citation
                    console.log("citation not found for: " + part)
                    return "";
                }
                else {
                    // splitting the full file path from citation_lookup into an array and then slicing it to get the folders, file name, and extension 
                    // the first 4 elements of the full file path are the "https:", "", "blob storaage url", and "container name" which are not needed in the display
                    let citationShortName: string = citation_lookup[part].citation.split("/").slice(4).join("/");
                    let citationIndex: number;

                    // Check if the citationShortName is already in the citations array
                    if (citations.includes(citationShortName)) {
                        // If it exists, use the existing index (add 1 because array is 0-based but citation numbers are 1-based)
                        citationIndex = citations.indexOf(citationShortName) + 1;
                    } else {
                        // If it's a new citation, add it to the array
                        citations.push(citationShortName);
                        citationIndex = citations.length; // The new index is the length of the array

                        // switch these to the citationShortName as key to allow dynamic lookup of the source path and page number
                        // The "FileX" moniker will not be used beyond this point in the UX code
                        sourceFiles[citationShortName] = citation.source_path;

                        // Check if the page_number property is a valid number.
                        if (!isNaN(Number(citation.page_number))) {
                            const pageNumber: number = Number(citation.page_number);
                            pageNumbers[citationShortName] = pageNumber;
                        } else {
                            console.log("page not found for: " + part)
                            // The page_number property is not a valid number, but we still generate a citation.
                            pageNumbers[citationShortName] = NaN;
                        }
                    }

                    const path = getCitationFilePath(citation.citation.split("/").slice(4).join("/"));
                    const sourcePath = citation.source_path;
                    const pageNumber = citation.page_number;

                    return renderToStaticMarkup(
                        <a
                            className="supContainer"
                            title={citation.citation.split("/").slice(-2, -1)[0]}
                            data-path={path}
                            data-source-path={sourcePath}
                            data-page-number={pageNumber}>
                            <sup>{citationIndex}</sup>
                        </a>
                    );
                }
            }

        });

        return {
            answerHtml: fragments.join(""),
            citations,
            sourceFiles,
            pageNumbers
        };
    }
}