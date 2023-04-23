import { Button, IconButton } from "@chakra-ui/react";
import { ArrowBackIcon } from "@chakra-ui/icons";
import { WordSelected } from "./Controls";
import { Word } from "tift-types/src/messages/output";

const ICONS : {[key:string]:React.ReactElement} = { 
    "__BACKSPACE__" : <ArrowBackIcon/>
}

interface WordProps {
    word : Word;
    wordSelected : WordSelected;
    disabled? : boolean;
}

// Disable button hover effect on touchscreens
const touchScreenNoHover = {
 "@media(hover: none)": {
    _hover: { 
        bg: "hoverbg"
    }
  }, 
}

const WordButton = ({ word, wordSelected, disabled } : WordProps) => 
        (word.type === "control" && ICONS[word.id])
            ? (<IconButton variant="ghost" 
                           aria-label="backspace"
                           onClick={(event) => wordSelected(event,word)}
                           icon={ICONS[word.id]}
                           sx={touchScreenNoHover}
                           isDisabled={disabled}/>)
            : (<Button variant="ghost"
                value={word.id} 
                onClick={(event) => wordSelected(event, word)}
                sx={touchScreenNoHover}
                isDisabled={disabled}>{word.value}</Button>)

export default WordButton;